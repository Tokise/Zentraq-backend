import request from "supertest";
import { describe, expect, it } from "vitest";

import { createIdentityApp } from "./app.js";

const secret = "identity-test-secret-that-is-longer-than-thirty-two-characters";

describe("identity service boundary", () => {
  // Rejects public callers that try to resolve tokens without service credentials.
  it("rejects direct access to internal authentication", async () => {
    const app = createIdentityApp({
      contextSecret: secret,
      internalServiceKey: secret,
    });
    const response = await request(app)
      .post("/internal/auth/resolve")
      .set("authorization", "Bearer invalid");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_SERVICE_CREDENTIAL");
  });

  // Rejects direct browser access to user data without signed gateway context.
  it("rejects unsigned public API requests", async () => {
    const app = createIdentityApp({
      contextSecret: secret,
      internalServiceKey: secret,
    });
    const response = await request(app).get("/api/v1/users/me");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("DIRECT_SERVICE_ACCESS");
  });
});
