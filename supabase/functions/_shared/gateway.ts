const MAX_CLOCK_SKEW_MS = 60_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface VerifiedGatewayRequest {
  path: string;
  requestId: string;
}

// Verifies one replay-bounded gateway signature and its exact request body.
export async function verifyGatewayRequest(
  request: Request,
  body: string,
  allowedPrefixes: string[],
): Promise<VerifiedGatewayRequest | null> {
  const secret = Deno.env.get("EDGE_GATEWAY_HMAC_SECRET");
  const bodySha256 = request.headers.get("x-zentraq-body-sha256");
  const path = request.headers.get("x-zentraq-path");
  const requestId = request.headers.get("x-request-id");
  const signature = request.headers.get("x-zentraq-signature");
  const timestamp = request.headers.get("x-zentraq-timestamp");
  if (
    !secret ||
    secret.length < 32 ||
    !bodySha256 ||
    !path ||
    !requestId ||
    !signature ||
    !timestamp ||
    !UUID_PATTERN.test(requestId)
  ) {
    return null;
  }

  const timestampNumber = Number(timestamp);
  if (
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS
  ) {
    return null;
  }

  const parsedPath = new URL(path, "https://gateway.local").pathname;
  if (
    !allowedPrefixes.some((prefix) =>
      parsedPath === prefix || parsedPath.startsWith(`${prefix}/`)
    )
  ) {
    return null;
  }

  const actualBodyHash = await sha256Hex(body);
  if (!constantTimeEqual(bodySha256, actualBodyHash)) return null;

  const canonical = [
    timestamp,
    requestId,
    request.method.toUpperCase(),
    path,
    actualBodyHash,
  ].join("\n");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlBytes(signature).buffer as ArrayBuffer,
    new TextEncoder().encode(canonical),
  );
  return verified ? { path, requestId } : null;
}

// Hashes the exact forwarded request body for signature verification.
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Decodes one unpadded base64url signature.
function base64UrlBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + (4 - normalized.length % 4) % 4,
    "=",
  );
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

// Compares public body hashes without early return timing differences.
function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
