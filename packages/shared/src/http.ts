import { AppError } from "./errors.js";
import { signInternalContext } from "./security.js";
import type { ApiResponse, AuthContext } from "./types.js";

interface ServiceRequestOptions {
  body?: unknown;
  context?: AuthContext;
  contextSecret?: string;
  method?: string;
  requestId: string;
  serviceKey?: string;
  timeoutMs?: number;
}

// Calls another service with bounded latency and trusted internal headers.
export async function serviceRequest<T>(
  url: string,
  options: ServiceRequestOptions,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 8_000,
  );
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "x-request-id": options.requestId,
  });
  if (options.serviceKey) {
    headers.set("x-zentraq-service-key", options.serviceKey);
  }
  if (options.context && options.contextSecret) {
    const signed = signInternalContext(options.context, options.contextSecret);
    headers.set("x-zentraq-context", signed.payload);
    headers.set("x-zentraq-signature", signed.signature);
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success) {
      const code = payload.success ? "SERVICE_ERROR" : payload.error.code;
      const message = payload.success
        ? "A dependent service rejected the request."
        : payload.error.message;
      throw new AppError(response.status, code, message);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const isTimeout = error instanceof Error && error.name === "AbortError";
    throw new AppError(
      503,
      isTimeout ? "SERVICE_TIMEOUT" : "SERVICE_UNAVAILABLE",
      "A required service is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
