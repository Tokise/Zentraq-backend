import type { Express, NextFunction, Request, Response } from "express";

import {
  AppError,
  asyncRoute,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  requireStrongSecret,
  signInternalContext,
  type ApiResponse,
  type ZentraqRole,
} from "@zentraq/shared";

interface AuthResolution {
  roles: ZentraqRole[];
  userId: string;
}

interface GatewayDependencies {
  contextSecret?: string;
  internalServiceKey?: string;
  resolveToken?: (token: string, requestId: string) => Promise<AuthResolution>;
  serviceUrls?: Partial<Record<ServiceName, string>>;
  timeoutMs?: number;
}

type ServiceName =
  | "ai"
  | "appointments"
  | "clinical"
  | "identity"
  | "inventory"
  | "notifications"
  | "reporting";

const ROUTES: Array<{ prefixes: string[]; service: ServiceName }> = [
  { prefixes: ["/api/v1/rfid/check-ins"], service: "clinical" },
  { prefixes: ["/api/v1/users", "/api/v1/rfid"], service: "identity" },
  {
    prefixes: [
      "/api/v1/records",
      "/api/v1/consultations",
      "/api/v1/visits",
    ],
    service: "clinical",
  },
  { prefixes: ["/api/v1/appointments"], service: "appointments" },
  { prefixes: ["/api/v1/inventory"], service: "inventory" },
  {
    prefixes: ["/api/v1/notifications", "/api/v1/notification-jobs"],
    service: "notifications",
  },
  {
    prefixes: [
      "/api/v1/reports",
      "/api/v1/report-jobs",
      "/api/v1/audit",
      "/api/v1/dashboard",
    ],
    service: "reporting",
  },
  { prefixes: ["/api/v1/ai"], service: "ai" },
];

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Creates the public gateway without giving it ownership of domain data.
export function createGatewayApp(dependencies: GatewayDependencies = {}): Express {
  const app = createServiceApp("api-gateway");
  app.set("trust proxy", 1);
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(
      process.env.INTERNAL_CONTEXT_SECRET,
      "INTERNAL_CONTEXT_SECRET",
    );
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.SERVICE_TIMEOUT_MS ?? 8_000);
  const serviceUrls = serviceUrlMap(dependencies.serviceUrls);
  const resolveToken =
    dependencies.resolveToken ??
    ((token: string, requestId: string) =>
      resolveIdentityToken(
        token,
        requestId,
        serviceUrls.identity,
        internalServiceKey,
        timeoutMs,
      ));

  app.use(restrictCors);
  app.use("/api/v1", gatewayRateLimit);
  app.use(
    "/api/v1",
    asyncRoute(async (request, _response, next) => {
      const token = bearerToken(request);
      const identity = await resolveToken(token, request.requestId);
      request.auth = {
        expiresAt: Date.now() + 30_000,
        requestId: request.requestId,
        roles: identity.roles,
        userId: identity.userId,
      };
      next();
    }),
  );
  app.use(
    "/api/v1",
    asyncRoute(async (request, response) => {
      await proxyDomainRequest(
        request,
        response,
        serviceUrls,
        contextSecret,
        timeoutMs,
      );
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Applies strict same-origin allowlisting while permitting private service calls.
function restrictCors(request: Request, response: Response, next: NextFunction): void {
  const origin = request.header("origin");
  const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origin && !allowed.includes(origin)) {
    next(new AppError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed."));
    return;
  }
  if (origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader(
      "access-control-allow-headers",
      "authorization,content-type,x-request-id",
    );
    response.setHeader(
      "access-control-allow-methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
}

// Enforces a bounded process-local gateway request budget per client address.
function gatewayRateLimit(request: Request, response: Response, next: NextFunction): void {
  const now = Date.now();
  const key = request.ip ?? "unknown";
  const current = rateBuckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + 60_000 }
      : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  response.setHeader("ratelimit-limit", "120");
  response.setHeader("ratelimit-remaining", String(Math.max(0, 120 - bucket.count)));
  if (bucket.count > 120) {
    next(new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly."));
    return;
  }
  next();
}

// Extracts the Supabase access token without accepting identity from request data.
function bearerToken(request: Request): string {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required.");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required.");
  }
  return token;
}

// Resolves one verified token and protected database role through Identity Service.
async function resolveIdentityToken(
  token: string,
  requestId: string,
  identityUrl: string,
  internalServiceKey: string,
  timeoutMs: number,
): Promise<AuthResolution> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${identityUrl}/internal/auth/resolve`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-zentraq-service-key": internalServiceKey,
      },
      signal: controller.signal,
    });
    const payload = (await response.json()) as ApiResponse<AuthResolution>;
    if (!response.ok || !payload.success) {
      throw new AppError(
        response.status === 401 ? 401 : 503,
        response.status === 401 ? "UNAUTHENTICATED" : "IDENTITY_UNAVAILABLE",
        response.status === 401
          ? "A valid access token is required."
          : "Identity verification is temporarily unavailable.",
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "IDENTITY_UNAVAILABLE",
      "Identity verification is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Routes a sanitized request to the service that owns the public path.
async function proxyDomainRequest(
  request: Request,
  response: Response,
  serviceUrls: Record<ServiceName, string>,
  contextSecret: string,
  timeoutMs: number,
): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  const pathname = new URL(request.originalUrl, "http://gateway.local").pathname;
  const route = ROUTES.find((candidate) =>
    candidate.prefixes.some((prefix) => pathname.startsWith(prefix)),
  );
  if (!route) throw new AppError(404, "NOT_FOUND", "No service owns this route.");

  const signed = signInternalContext(request.auth, contextSecret);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(
      `${serviceUrls[route.service]}${request.originalUrl}`,
      {
        method: request.method,
        headers: {
          accept: "application/json",
          authorization: request.header("authorization") ?? "",
          "content-type": "application/json",
          "x-request-id": request.requestId,
          "x-zentraq-context": signed.payload,
          "x-zentraq-signature": signed.signature,
        },
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : JSON.stringify(request.body ?? {}),
        signal: controller.signal,
      },
    );
    const body = await upstream.text();
    response.status(upstream.status);
    response.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json",
    );
    response.send(body);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    throw new AppError(
      503,
      isTimeout ? "SERVICE_TIMEOUT" : "SERVICE_UNAVAILABLE",
      "The requested service is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Resolves environment-backed internal service URLs without exposing them publicly.
function serviceUrlMap(
  overrides: GatewayDependencies["serviceUrls"],
): Record<ServiceName, string> {
  return {
    ai: overrides?.ai ?? process.env.AI_SERVICE_URL ?? "http://localhost:4007",
    appointments:
      overrides?.appointments ??
      process.env.APPOINTMENT_SERVICE_URL ??
      "http://localhost:4003",
    clinical:
      overrides?.clinical ?? process.env.CLINICAL_SERVICE_URL ?? "http://localhost:4002",
    identity:
      overrides?.identity ?? process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4001",
    inventory:
      overrides?.inventory ?? process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4004",
    notifications:
      overrides?.notifications ??
      process.env.NOTIFICATION_SERVICE_URL ??
      "http://localhost:4005",
    reporting:
      overrides?.reporting ?? process.env.REPORTING_SERVICE_URL ?? "http://localhost:4006",
  };
}
