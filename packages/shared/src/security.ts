import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "./errors.js";
import {
  ZENTRAQ_ROLES,
  type AuthContext,
  type ZentraqRole,
} from "./types.js";

const internalContextSchema = z.object({
  expiresAt: z.number().int().positive(),
  requestId: z.string().uuid(),
  roles: z.array(z.enum(ZENTRAQ_ROLES)).min(1),
  userId: z.string().uuid(),
});

// Rejects short shared secrets that do not provide an adequate security margin.
export function requireStrongSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters.`);
  }
  return value;
}

// Compares secret values without data-dependent timing.
export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

// Creates an expiring signed context for gateway-to-service authorization.
export function signInternalContext(
  context: AuthContext,
  secret: string,
): { payload: string; signature: string } {
  const payload = Buffer.from(JSON.stringify(context)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return { payload, signature };
}

// Validates the signature, shape, expiry, and request binding of internal context.
export function verifyInternalContext(
  payload: string,
  signature: string,
  secret: string,
  requestId: string,
): AuthContext {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(signature, expected)) {
    throw new AppError(403, "INVALID_INTERNAL_CONTEXT", "Internal authorization failed.");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new AppError(403, "INVALID_INTERNAL_CONTEXT", "Internal authorization failed.");
  }
  const result = internalContextSchema.safeParse(parsedPayload);
  if (
    !result.success ||
    result.data.expiresAt <= Date.now() ||
    result.data.requestId !== requestId
  ) {
    throw new AppError(403, "INVALID_INTERNAL_CONTEXT", "Internal authorization failed.");
  }
  return result.data;
}

// Requires a valid signed user context on a private domain service.
export function requireInternalContext(secret: string) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const payload = request.header("x-zentraq-context");
    const signature = request.header("x-zentraq-signature");
    if (!payload || !signature) {
      next(new AppError(403, "DIRECT_SERVICE_ACCESS", "Direct service access is not allowed."));
      return;
    }
    try {
      request.auth = verifyInternalContext(
        payload,
        signature,
        secret,
        request.requestId,
      );
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Requires a trusted internal service credential for non-user service calls.
export function requireInternalServiceKey(secret: string) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const provided = request.header("x-zentraq-service-key");
    if (!provided || !safeEqual(provided, secret)) {
      next(new AppError(403, "INVALID_SERVICE_CREDENTIAL", "Service authorization failed."));
      return;
    }
    next();
  };
}

// Requires the authenticated context to contain at least one allowed role.
export function requireRoles(...roles: ZentraqRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(new AppError(401, "UNAUTHENTICATED", "Authentication is required."));
      return;
    }
    if (!roles.some((role) => request.auth?.roles.includes(role))) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}

// Returns the first role matching the service's explicit precedence order.
export function primaryRole(
  context: AuthContext,
  precedence: readonly ZentraqRole[] = ZENTRAQ_ROLES,
): ZentraqRole {
  const role = precedence.find((candidate) => context.roles.includes(candidate));
  if (!role) throw new AppError(403, "ROLE_REQUIRED", "An active role is required.");
  return role;
}

interface EdgeRequestInput {
  body: string;
  method: string;
  path: string;
  requestId: string;
  timestamp: string;
}

// Creates a replay-bounded signature for one gateway-to-Edge request.
export function signEdgeRequest(
  input: EdgeRequestInput,
  secret: string,
): { bodySha256: string; signature: string } {
  const bodySha256 = createHash("sha256")
    .update(input.body)
    .digest("hex");
  const canonical = [
    input.timestamp,
    input.requestId,
    input.method.toUpperCase(),
    input.path,
    bodySha256,
  ].join("\n");
  const signature = createHmac("sha256", secret)
    .update(canonical)
    .digest("base64url");
  return { bodySha256, signature };
}
