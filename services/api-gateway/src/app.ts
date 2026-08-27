import type { Express, NextFunction, Request, Response as ExpressResponse } from "express";

import {
  AppError,
  asyncRoute,
  createAuthClient,
  createServiceApp,
  createUserClient,
  errorHandler,
  notFoundHandler,
  requireStrongSecret,
  signEdgeRequest,
  signInternalContext,
  ZENTRAQ_ROLES,
  type ZentraqRole,
} from "@zentraq/shared";

interface AuthResolution {
  roles: ZentraqRole[];
  userId: string;
}

interface RequestContextRow {
  roles: string[];
  user_id: string;
}

interface GatewayDependencies {
  contextSecret?: string;
  edgeFunctionsUrl?: string;
  edgeGatewaySecret?: string;
  publishableKey?: string;
  resolveToken?: (token: string, requestId: string) => Promise<AuthResolution>;
  serviceUrls?: Partial<Record<ServiceName, string>>;
  timeoutMs?: number;
}

type ServiceName =
  | "ai"
  | "appointments"
  | "inventory"
  | "notifications"
  | "reporting";

type RouteTarget =
  | { functionName: "clinical-service"; kind: "edge" }
  | { kind: "render"; service: ServiceName };

const ROUTES: Array<{ prefixes: string[]; target: RouteTarget }> = [

  {
    prefixes: [
      "/api/v1/records",
      "/api/v1/consultations",
      "/api/v1/visits",
      "/api/v1/clinical",
    ],
    target: { functionName: "clinical-service", kind: "edge" },
  },
  {
    prefixes: ["/api/v1/appointments"],
    target: { kind: "render", service: "appointments" },
  },
  {
    prefixes: ["/api/v1/inventory"],
    target: { kind: "render", service: "inventory" },
  },
  {
    prefixes: ["/api/v1/notifications", "/api/v1/notification-jobs"],
    target: { kind: "render", service: "notifications" },
  },
  {
    prefixes: [
      "/api/v1/reports",
      "/api/v1/report-jobs",
      "/api/v1/report-delivery-jobs",
      "/api/v1/audit",
      "/api/v1/dashboard",
    ],
    target: { kind: "render", service: "reporting" },
  },
  {
    prefixes: ["/api/v1/ai"],
    target: { kind: "render", service: "ai" },
  },
];

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Creates the public gateway without privileged database credentials.
export function createGatewayApp(
  dependencies: GatewayDependencies = {},
): Express {
  const app = createServiceApp("api-gateway");
  app.set("trust proxy", 1);
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(
      process.env.INTERNAL_CONTEXT_SECRET,
      "INTERNAL_CONTEXT_SECRET",
    );
  const edgeGatewaySecret =
    dependencies.edgeGatewaySecret ??
    requireStrongSecret(
      process.env.EDGE_GATEWAY_HMAC_SECRET,
      "EDGE_GATEWAY_HMAC_SECRET",
    );
  const publishableKey =
    dependencies.publishableKey ??
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY");
  const edgeFunctionsUrl =
    dependencies.edgeFunctionsUrl ??
    requiredEnvironment("SUPABASE_EDGE_FUNCTIONS_URL");
  const timeoutMs =
    dependencies.timeoutMs ??
    Number(process.env.SERVICE_TIMEOUT_MS ?? 65_000);
  const serviceUrls = serviceUrlMap(dependencies.serviceUrls);
  const resolveToken =
    dependencies.resolveToken ?? resolveRequestContext;

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
      await proxyDomainRequest(request, response, {
        contextSecret,
        edgeFunctionsUrl,
        edgeGatewaySecret,
        publishableKey,
        serviceUrls,
        timeoutMs,
      });
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Applies strict same-origin allowlisting while permitting server calls without Origin.
function restrictCors(
  request: Request,
  response: ExpressResponse,
  next: NextFunction,
): void {
  const origin = request.header("origin");
  const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const normalizedOrigin = origin?.replace(/\/$/, "");
  if (normalizedOrigin && !allowed.includes(normalizedOrigin)) {
    next(
      new AppError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "This request origin is not allowed.",
      ),
    );
    return;
  }
  if (origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader(
      "access-control-allow-headers",
      "authorization,content-type,x-request-id,x-api-key,apikey",
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
function gatewayRateLimit(
  request: Request,
  response: ExpressResponse,
  next: NextFunction,
): void {
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
  response.setHeader(
    "ratelimit-remaining",
    String(Math.max(0, 120 - bucket.count)),
  );
  if (bucket.count > 120) {
    next(
      new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again shortly.",
      ),
    );
    return;
  }
  next();
}

// Extracts the Supabase access token without accepting identity from request data.
function bearerToken(request: Request): string {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "A valid access token is required.",
    );
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "A valid access token is required.",
    );
  }
  return token;
}

// Resolves a verified user and active roles through caller-scoped Supabase access.
async function resolveRequestContext(
  token: string,
  _requestId: string,
): Promise<AuthResolution> {
  const {
    data: { user },
    error: authError,
  } = await createAuthClient().auth.getUser(token);
  if (authError || !user) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "A valid access token is required.",
    );
  }

  const { data, error } = await createUserClient(token).rpc(
    "resolve_request_context_v1",
  );
  const row = Array.isArray(data)
    ? (data[0] as RequestContextRow | undefined)
    : undefined;
  if (error) {
    throw new AppError(
      503,
      "AUTHORIZATION_UNAVAILABLE",
      "Authorization is temporarily unavailable.",
    );
  }
  if (!row || row.user_id !== user.id) {
    throw new AppError(
      403,
      "ROLE_REQUIRED",
      "An active Zentraq role is required.",
    );
  }

  const allowed = new Set<string>(ZENTRAQ_ROLES);
  const roles = [...new Set(row.roles)]
    .filter((role) => allowed.has(role)) as ZentraqRole[];
  if (roles.length === 0) {
    throw new AppError(
      403,
      "ROLE_REQUIRED",
      "An active Zentraq role is required.",
    );
  }
  return { roles, userId: user.id };
}

interface ProxyConfiguration {
  contextSecret: string;
  edgeFunctionsUrl: string;
  edgeGatewaySecret: string;
  publishableKey: string;
  serviceUrls: Record<ServiceName, string>;
  timeoutMs: number;
}

// Routes a sanitized request to the service or Edge Function owning the path.
async function proxyDomainRequest(
  request: Request,
  response: ExpressResponse,
  configuration: ProxyConfiguration,
): Promise<void> {
  if (!request.auth) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  const pathname = new URL(
    request.originalUrl,
    "http://gateway.local",
  ).pathname;
  const route = ROUTES.find((candidate) =>
    candidate.prefixes.some((prefix) => pathname.startsWith(prefix)),
  );
  if (!route) {
    throw new AppError(
      404,
      "NOT_FOUND",
      "No service owns this route.",
    );
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? ""
      : JSON.stringify(request.body ?? {});
  const upstream = await fetchUpstream(
    request,
    route.target,
    request.originalUrl,
    body,
    configuration,
  );
  const responseBody = await upstream.text();
  response.status(upstream.status);
  response.setHeader("x-request-id", request.requestId);
  response.setHeader(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  response.send(responseBody);
}

// Calls one upstream with a single automatic retry only for idempotent GET requests.
async function fetchUpstream(
  request: Request,
  target: RouteTarget,
  signedPath: string,
  body: string,
  configuration: ProxyConfiguration,
): Promise<globalThis.Response> {
  const attempts = request.method === "GET" ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      configuration.timeoutMs,
    );
    try {
      return await fetch(
        upstreamUrl(target, request.originalUrl, configuration),
        {
          body: body || undefined,
          headers: upstreamHeaders(
            request,
            target,
            signedPath,
            body,
            configuration,
          ),
          method: request.method,
          signal: controller.signal,
        },
      );
    } catch (error) {
      const retry = attempt < attempts;
      if (!retry) {
        const isTimeout =
          error instanceof Error && error.name === "AbortError";
        throw new AppError(
          503,
          isTimeout ? "SERVICE_TIMEOUT" : "SERVICE_UNAVAILABLE",
          "The requested service is temporarily unavailable.",
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "The requested service is temporarily unavailable.",
  );
}

// Builds upstream headers for either caller-scoped Edge or signed Render traffic.
function upstreamHeaders(
  request: Request,
  target: RouteTarget,
  signedPath: string,
  body: string,
  configuration: ProxyConfiguration,
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: request.header("authorization") ?? "",
    "content-type": "application/json",
    "x-request-id": request.requestId,
  };
  if (target.kind === "render") {
    const signed = signInternalContext(
      request.auth!,
      configuration.contextSecret,
    );
    headers["x-zentraq-context"] = signed.payload;
    headers["x-zentraq-signature"] = signed.signature;
    return headers;
  }

  const timestamp = String(Date.now());
  const signed = signEdgeRequest(
    {
      body,
      method: request.method,
      path: signedPath,
      requestId: request.requestId,
      timestamp,
    },
    configuration.edgeGatewaySecret,
  );
  headers.apikey = configuration.publishableKey;
  headers["x-zentraq-body-sha256"] = signed.bodySha256;
  headers["x-zentraq-path"] = signedPath;
  headers["x-zentraq-timestamp"] = timestamp;
  headers["x-zentraq-signature"] = signed.signature;
  return headers;
}

// Resolves the concrete upstream URL without accepting caller-controlled hosts.
function upstreamUrl(
  target: RouteTarget,
  originalUrl: string,
  configuration: ProxyConfiguration,
): string {
  if (target.kind === "edge") {
    const query = new URL(originalUrl, "https://gateway.local").search;
    return `${configuration.edgeFunctionsUrl.replace(/\/$/, "")}/${target.functionName}${query}`;
  }
  return `${configuration.serviceUrls[target.service]}${originalUrl}`;
}

// Resolves environment-backed Render service URLs.
function serviceUrlMap(
  overrides: GatewayDependencies["serviceUrls"],
): Record<ServiceName, string> {
  return {
    ai: overrides?.ai ?? process.env.AI_SERVICE_URL ?? "http://localhost:4007",
    appointments:
      overrides?.appointments ??
      process.env.APPOINTMENT_SERVICE_URL ??
      "http://localhost:4003",
    inventory:
      overrides?.inventory ??
      process.env.INVENTORY_SERVICE_URL ??
      "http://localhost:4004",
    notifications:
      overrides?.notifications ??
      process.env.NOTIFICATION_SERVICE_URL ??
      "http://localhost:4005",
    reporting:
      overrides?.reporting ??
      process.env.REPORTING_SERVICE_URL ??
      "http://localhost:4006",
  };
}

// Reads one required gateway environment value without logging it.
function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
