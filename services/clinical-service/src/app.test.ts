import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { signInternalContext } from "@zentraq/shared";

import { createClinicalApp } from "./app.js";

const secret = "clinical-test-secret-that-is-longer-than-thirty-two-characters";

// Creates headers matching one gateway-signed user request.
function signedHeaders(
  userId: string,
  roles: Array<"admin" | "doctor" | "nurse" | "student">,
) {
  const requestId = randomUUID();
  const signed = signInternalContext(
    {
      expiresAt: Date.now() + 30_000,
      requestId,
      roles,
      userId,
    },
    secret,
  );
  return {
    "x-request-id": requestId,
    "x-zentraq-context": signed.payload,
    "x-zentraq-signature": signed.signature,
  };
}

describe("clinical RFID boundary", () => {
  // Delegates one valid staff request while preserving the caller token.
  it("invokes the retained RFID function through clinical-service", async () => {
    const userId = randomUUID();
    const eventId = randomUUID();
    const invokeRfidCheckIn = vi.fn(async () => ({
      clinicPhotoUrl: null,
      consultationId: randomUUID(),
      createdNew: true,
      firstName: "Test",
      lastName: "Patient",
      patientId: randomUUID(),
      patientType: "student" as const,
      queueEntryId: randomUUID(),
    }));
    const app = createClinicalApp({
      contextSecret: secret,
      internalServiceKey: secret,
      invokeRfidCheckIn,
    });
    const response = await request(app)
      .post("/api/v1/rfid/check-ins")
      .set(signedHeaders(userId, ["nurse"]))
      .set("authorization", "Bearer user-access-token")
      .send({ eventId, rfidUid: "CARD-1234" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(invokeRfidCheckIn).toHaveBeenCalledWith(
      { eventId, rfidUid: "CARD-1234" },
      "user-access-token",
      8_000,
    );
  });

  // Rejects patient roles before the RFID executor can run.
  it("rejects unauthorized RFID roles", async () => {
    const invokeRfidCheckIn = vi.fn();
    const app = createClinicalApp({
      contextSecret: secret,
      internalServiceKey: secret,
      invokeRfidCheckIn,
    });
    const response = await request(app)
      .post("/api/v1/rfid/check-ins")
      .set(signedHeaders(randomUUID(), ["student"]))
      .set("authorization", "Bearer user-access-token")
      .send({
        eventId: randomUUID(),
        rfidUid: "CARD-1234",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(invokeRfidCheckIn).not.toHaveBeenCalled();
  });

  // Rejects control characters before any Edge Function request is made.
  it("rejects malformed RFID identifiers", async () => {
    const invokeRfidCheckIn = vi.fn();
    const app = createClinicalApp({
      contextSecret: secret,
      internalServiceKey: secret,
      invokeRfidCheckIn,
    });
    const response = await request(app)
      .post("/api/v1/rfid/check-ins")
      .set(signedHeaders(randomUUID(), ["doctor"]))
      .set("authorization", "Bearer user-access-token")
      .send({
        eventId: randomUUID(),
        rfidUid: "CARD\u0001",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(invokeRfidCheckIn).not.toHaveBeenCalled();
  });
});
