import { handleClinicalRequest, type ClinicalWorkerEnv } from "./handler.js";

// Permitted origins for CORS preflight and response headers.
function allowedOrigins(env: ClinicalWorkerEnv): string[] {
  return [
    "https://bcp.tokise.pw",
    ...(env.ENVIRONMENT !== "production" ? ["http://localhost:3000"] : []),
  ];
}

function corsHeaders(
  request: Request,
  env: ClinicalWorkerEnv,
): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins(env);
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (!normalizedOrigin || !allowed.includes(normalizedOrigin)) {
    return {};
  }
  return {
    "access-control-allow-origin": normalizedOrigin,
    "access-control-allow-headers":
      "authorization,content-type,x-request-id,x-zentraq-session-proof,x-region,apikey",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

export default {
  async fetch(
    request: Request,
    env: ClinicalWorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Expose env bindings to domain code that reads process.env directly
    // (redis.ts, rfid-rollout.ts). nodejs_compat provides process.env.
    if (env.UPSTASH_REDIS_REST_URL) {
      process.env.UPSTASH_REDIS_REST_URL = env.UPSTASH_REDIS_REST_URL;
    }
    if (env.UPSTASH_REDIS_REST_TOKEN) {
      process.env.UPSTASH_REDIS_REST_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;
    }
    if (env.SUPABASE_URL) {
      process.env.SUPABASE_URL = env.SUPABASE_URL;
    }
    if (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
    }
    if (env.ZENTRAQ_SERVERLESS_RFID_ENABLED) {
      process.env.ZENTRAQ_SERVERLESS_RFID_ENABLED = env.ZENTRAQ_SERVERLESS_RFID_ENABLED;
    }
    if (env.ZENTRAQ_SERVERLESS_RFID_CANARY_IDS) {
      process.env.ZENTRAQ_SERVERLESS_RFID_CANARY_IDS = env.ZENTRAQ_SERVERLESS_RFID_CANARY_IDS;
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    const response = await handleClinicalRequest(request, env, ctx);

    // Apply CORS headers to the actual response
    const cors = corsHeaders(request, env);
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }

    return response;
  },
} satisfies ExportedHandler<ClinicalWorkerEnv>;
