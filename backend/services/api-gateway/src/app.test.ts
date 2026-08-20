import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createGatewayApp } from "./app.js";

const secret =
  "gateway-test-secret-that-is-longer-than-thirty-two-characters";

// Provides non-secret test-only gateway dependencies without environment access.
function gatewayDependencies() {
  return {
    contextSecret: secret,
    edgeFunctionsUrl: "http://127.0.0.1:9",
    edgeGatewaySecret: secret,
    publishableKey: "test-publishable-key",
    resolveToken: async () => ({
      roles: ["admin"] as const,
      userId: randomUUID(),
    }),
  };
}

describe("api gateway", () => {
  // Confirms the public health endpoint does not reveal configuration.
  it("returns a minimal health response", async () => {
    const app = createGatewayApp(gatewayDependencies());
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api-gateway",
    });
  });

  // Rejects clinic-domain requests that do not carry a Supabase access token.
  it("returns 401 when the bearer token is missing", async () => {
    const app = createGatewayApp(gatewayDependencies());
    const response = await request(app).get("/api/v1/appointments");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});
