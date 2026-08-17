import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { signInternalContext } from "@zentraq/shared";

import { createAiApp } from "./app.js";

const secret = "ai-test-context-secret-that-is-longer-than-thirty-two-characters";

// Creates trusted gateway headers for one test role.
function contextHeaders(role: "admin" | "student") {
  const requestId = randomUUID();
  const signed = signInternalContext(
    {
      expiresAt: Date.now() + 30_000,
      requestId,
      roles: [role],
      userId: randomUUID(),
    },
    secret,
  );
  return {
    "x-request-id": requestId,
    "x-zentraq-context": signed.payload,
    "x-zentraq-signature": signed.signature,
  };
}

describe("ai service authorization and fallback", () => {
  // Enforces route-specific roles after accepting a valid gateway signature.
  it("returns 403 when a student requests inventory insights", async () => {
    const response = await request(createAiApp({ contextSecret: secret }))
      .post("/api/v1/ai/inventory/insights")
      .set(contextHeaders("student"))
      .send({ items: [] });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  // Returns a labeled deterministic advisory result when OpenRouter is unavailable.
  it("keeps inventory guidance available without an AI provider", async () => {
    const response = await request(createAiApp({ contextSecret: secret }))
      .post("/api/v1/ai/inventory/insights")
      .set(contextHeaders("admin"))
      .send({
        items: [
          {
            averageDailyUse: 5,
            currentStock: 10,
            medicineId: randomUUID(),
          },
        ],
      });
    expect(response.status).toBe(200);
    expect(response.body.data.source).toBe("fallback");
    expect(response.body.data.data.insights[0].risk).toBe("high");
  });
});
