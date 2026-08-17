import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createGatewayApp } from "./app.js";

const secret = "gateway-test-secret-that-is-longer-than-thirty-two-characters";

describe("api gateway", () => {
  // Confirms the public health endpoint does not reveal configuration.
  it("returns a minimal health response", async () => {
    const app = createGatewayApp({
      contextSecret: secret,
      internalServiceKey: secret,
      resolveToken: async () => ({ roles: ["admin"], userId: randomUUID() }),
    });
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "api-gateway" });
  });

  // Rejects clinic-domain requests that do not carry a Supabase access token.
  it("returns 401 when the bearer token is missing", async () => {
    const app = createGatewayApp({
      contextSecret: secret,
      internalServiceKey: secret,
      resolveToken: async () => ({ roles: ["admin"], userId: randomUUID() }),
    });
    const response = await request(app).get("/api/v1/users/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});
