import "jsr:@supabase/functions-js@2.112.3/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { operations } from "./operations.ts";
import {
  type ActionActor,
  type ClinicalContext,
  clinicalContext,
} from "./runtime/context.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 11 * 1024 * 1024;

// Bounds JSON and multipart parsing before operation-specific validation.
async function readArguments(request: Request): Promise<unknown[]> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = new Response(bytes, {
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
  });
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const form = await parsed.formData();
    const args = JSON.parse(String(form.get("__clinical_args")));
    form.delete("__clinical_args");
    if (!Array.isArray(args) || args.length > 6) {
      throw new Error("INVALID_REQUEST");
    }
    return args.map((arg) => arg?.__form === true ? form : arg);
  }
  const input = await parsed.json();
  if (!Array.isArray(input.args) || input.args.length > 6) {
    throw new Error("INVALID_REQUEST");
  }
  return input.args;
}

// Authenticates the JWT and live portal session before dispatching clinical work.
export async function handleClinicalRequest(
  request: Request,
): Promise<Response> {
  const startedAt = performance.now();
  const suppliedId = request.headers.get("x-request-id") ?? "";
  const requestId = UUID.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const name =
    new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const knownOperation = Object.hasOwn(operations, name);
  let status = 500;
  let errorCode: string | null = null;
  let phase = "request";
  let errorType: string | null = null;
  try {
    if (request.method !== "POST" || !knownOperation) {
      status = 404;
      errorCode = "NOT_FOUND";
      return errorResponse(
        { code: "NOT_FOUND", message: "Clinical operation not found." },
        status,
        requestId,
      );
    }
    const authorization = request.headers.get("authorization") ?? "";
    const proof = request.headers.get("x-zentraq-session-proof") ?? "";
    if (!authorization.startsWith("Bearer ") || !/^[a-f0-9]{64}$/.test(proof)) {
      status = 401;
      errorCode = "SESSION_REQUIRED";
      return errorResponse(
        { code: "SESSION_REQUIRED", message: "Sign in again to continue." },
        status,
        requestId,
      );
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    phase = "authentication";
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await client.auth.getUser(
      authorization.slice(7),
    );
    if (userError || !user) {
      status = 401;
      errorCode = "UNAUTHENTICATED";
      return errorResponse(
        { code: "UNAUTHENTICATED", message: "Sign in again to continue." },
        status,
        requestId,
      );
    }
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const validation = await admin.rpc("validate_portal_session_v1", {
      p_user_id: user.id,
      p_session_token_hash: proof,
    });
    const session = validation.data?.[0];
    const validRoles = [
      "admin",
      "doctor",
      "nurse",
      "student",
      "faculty",
      "staff",
    ];
    if (
      validation.error || !session?.valid || !validRoles.includes(session.role)
    ) {
      status = 401;
      errorCode = "SESSION_REVOKED";
      return errorResponse(
        {
          code: "SESSION_REVOKED",
          message: "Your session expired. Sign in again.",
        },
        status,
        requestId,
      );
    }
    const role = session.role as ActionActor["role"];
    phase = "account";
    const clinic = ["admin", "doctor", "nurse"].includes(role);
    let accountQuery = admin.from(
      clinic ? "clinic_accounts" : role === "student" ? "students" : role,
    )
      .select("id").eq("user_id", user.id)
      .eq(clinic ? "is_active" : "status", clinic ? true : "active");
    if (clinic) accountQuery = accountQuery.eq("role", role);
    const [account, appUser] = await Promise.all([
      accountQuery.limit(1).maybeSingle(),
      admin.from("users").select("id").eq("id", user.id).eq("is_active", true)
        .maybeSingle(),
    ]);
    if (account.error || !account.data || appUser.error || !appUser.data) {
      status = 403;
      errorCode = "ACCOUNT_INACTIVE";
      return errorResponse(
        { code: "ACCOUNT_INACTIVE", message: "An active account is required." },
        status,
        requestId,
      );
    }
    phase = "arguments";
    const args = await readArguments(request);
    const context: ClinicalContext = {
      actor: { id: user.id, email: user.email ?? null, role },
      admin,
      client,
      requestHeaders: new Headers({ "x-request-id": requestId }),
      paths: new Set(),
      tags: new Set(),
      effects: [],
    };
    const operation = operations[name as keyof typeof operations] as (
      ...args: unknown[]
    ) => Promise<unknown>;
    phase = "operation";
    const result = await clinicalContext.run(context, () => operation(...args));
    if (
      result && typeof result === "object" &&
      (Reflect.get(result, "error") || Reflect.get(result, "success") === false)
    ) {
      errorCode = "OPERATION_REJECTED";
    }
    if (context.effects.length) {
      EdgeRuntime.waitUntil(clinicalContext.run(context, async () => {
        await Promise.allSettled(context.effects.map((effect) => effect()));
      }));
    }
    status = 200;
    return successResponse({
      result,
      invalidation: { paths: [...context.paths], tags: [...context.tags] },
    }, requestId);
  } catch (error) {
    errorType = error instanceof TypeError
      ? "type_error"
      : error instanceof SyntaxError
      ? "syntax_error"
      : "runtime_error";
    const inputError = error instanceof SyntaxError ||
      (error instanceof Error &&
        ["INVALID_REQUEST", "REQUEST_TOO_LARGE"].includes(error.message));
    status = inputError ? 400 : 503;
    errorCode = inputError ? "INVALID_REQUEST" : "CLINICAL_UNAVAILABLE";
    return errorResponse(
      {
        code: errorCode,
        message: inputError
          ? "The clinical request is invalid."
          : "Clinical service is temporarily unavailable.",
      },
      status,
      requestId,
    );
  } finally {
    console.info(JSON.stringify({
      event: "clinical_operation",
      operation: knownOperation ? name : "unknown",
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      status,
      errorCode,
      phase,
      errorType,
    }));
  }
}
