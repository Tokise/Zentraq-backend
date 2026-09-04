import { strict as assert } from "node:assert";
import { handleClinicalRequest } from "./handler.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const VISIT = "33333333-3333-4333-8333-333333333333";

// Exercises the actual endpoint handler against a bounded, synthetic database transport.
async function invoke(options: {
  role?: string;
  valid?: boolean;
  active?: boolean;
  authenticated?: boolean;
  proof?: string;
  operation?: string;
  args?: unknown[];
  owns?: boolean;
}) {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  Deno.env.set("SUPABASE_URL", "https://clinical.test");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  globalThis.fetch = async (input) => {
    await Promise.resolve();
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") {
      return options.authenticated === false
        ? Response.json({ message: "Expired token" }, { status: 401 })
        : Response.json({ id: USER, email: "synthetic@example.test" });
    }
    if (url.pathname.endsWith("/validate_portal_session_v1")) {
      return Response.json([{
        valid: options.valid !== false,
        role: options.role ?? "doctor",
      }]);
    }
    if (url.pathname.endsWith("/consultations")) {
      if (options.operation === "getClinicalVisitHistoryAction") {
        assert.equal(url.searchParams.get("status"), "eq.completed");
        assert.equal(url.searchParams.get("offset"), "0");
        assert.equal(url.searchParams.get("limit"), "25");
        return Response.json([], {
          headers: { "content-range": "*/0" },
        });
      }
      assert(!url.searchParams.get("select")?.includes("patient_complaint"));
      return Response.json({
        status: "in-progress",
        claimed_by_user_id: options.owns ? USER : VISIT,
        claimed_by_clinic_account_id: options.owns ? ACCOUNT : VISIT,
      });
    }
    if (
      /\/(clinic_accounts|students|faculty|staff|users)$/.test(url.pathname)
    ) {
      return Response.json(options.active === false ? null : { id: ACCOUNT });
    }
    throw new Error("Unexpected backend access: " + url.pathname);
  };
  try {
    const response = await handleClinicalRequest(
      new Request(
        "https://clinical.test/functions/v1/clinical-service/" +
          (options.operation ?? "startConsultationWorkflowAction"),
        {
          method: "POST",
          headers: {
            authorization: "Bearer synthetic-token",
            "x-zentraq-session-proof": options.proof ?? "a".repeat(64),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            args: options.args ?? [{ consultation_id: VISIT }],
          }),
        },
      ),
    );
    return { status: response.status, body: await response.json(), calls };
  } finally {
    globalThis.fetch = previous;
  }
}

Deno.test("rejects missing proof before accessing authentication or patient data", async () => {
  const result = await invoke({ proof: "" });
  assert.equal(result.status, 401);
  assert.equal(result.calls.length, 0);
});

Deno.test("history accepts omitted and legacy null pagination arguments", async () => {
  for (const args of [[], [undefined], [null], [{}]]) {
    const result = await invoke({
      role: "admin",
      operation: "getClinicalVisitHistoryAction",
      args,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.result.error, null);
    assert.equal(result.body.data.result.page, 1);
    assert.equal(result.body.data.result.pageSize, 25);
    assert.equal(result.calls.at(-1), "/rest/v1/consultations");
  }
});

Deno.test("rejects expired JWTs and revoked or forged portal proofs", async () => {
  assert.equal((await invoke({ authenticated: false })).status, 401);
  const result = await invoke({ valid: false });
  assert.equal(result.status, 401);
  assert.equal(result.calls.length, 2);
});

Deno.test("invalid history pagination cannot reach the consultation query", async () => {
  const result = await invoke({
    role: "admin",
    operation: "getClinicalVisitHistoryAction",
    args: [{ page: "invalid" }],
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.result.error, "Invalid history pagination");
  assert(!result.calls.some((path) => path.endsWith("/consultations")));
});

Deno.test("rejects inactive accounts before clinical dispatch", async () => {
  assert.equal((await invoke({ active: false })).status, 403);
});

Deno.test("patient roles cannot invoke clinician transitions", async () => {
  const result = await invoke({ role: "student" });
  assert.equal(result.body.data.result.success, false);
  assert.equal(result.calls.length, 4);
});

Deno.test("another clinician cannot load an active encounter's clinical detail", async () => {
  const result = await invoke({
    operation: "getConsultationDetailAction",
    args: [VISIT],
  });
  assert.equal(result.body.data.result.consultation, null);
  assert.equal(
    result.calls.filter((path) => path.endsWith("/consultations")).length,
    1,
  );
});

Deno.test("unknown operations cannot dispatch arbitrary database work", async () => {
  const result = await invoke({ operation: "deleteAllRecords" });
  assert.equal(result.status, 404);
  assert.equal(result.calls.length, 0);
});

Deno.test("a patient cannot request another patient's clinic record endpoint", async () => {
  const result = await invoke({
    role: "student", operation: "getPatientMedicalRecordAction", args: [VISIT, "student"],
  });
  assert.equal(result.body.data.result.error, "Access denied");
  assert.equal(result.calls.length, 4);
});
