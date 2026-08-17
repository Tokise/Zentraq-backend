import { createServer } from "node:http";
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
      resolveToken: async () => ({
        roles: ["admin"],
        userId: randomUUID(),
      }),
    });
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api-gateway",
    });
  });

  // Rejects clinic-domain requests that do not carry a Supabase access token.
  it("returns 401 when the bearer token is missing", async () => {
    const app = createGatewayApp({
      contextSecret: secret,
      internalServiceKey: secret,
      resolveToken: async () => ({
        roles: ["admin"],
        userId: randomUUID(),
      }),
    });
    const response = await request(app).get("/api/v1/users/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  // Routes RFID to Clinical Service and forwards the original user token.
  it("forwards RFID requests and the user authorization header", async () => {
    const received: {
      authorization?: string;
      url?: string;
    } = {};
    const upstream = createServer((incoming, outgoing) => {
      received.authorization = incoming.headers.authorization;
      received.url = incoming.url;
      outgoing.writeHead(200, {
        "content-type": "application/json",
      });
      outgoing.end(
        JSON.stringify({
          success: true,
          data: { delegated: true },
        }),
      );
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, "127.0.0.1", resolve);
    });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      upstream.close();
      throw new Error("Unable to start the test service.");
    }
    try {
      const app = createGatewayApp({
        contextSecret: secret,
        internalServiceKey: secret,
        resolveToken: async () => ({
          roles: ["nurse"],
          userId: randomUUID(),
        }),
        serviceUrls: {
          clinical: `http://127.0.0.1:${address.port}`,
        },
      });
      const response = await request(app)
        .post("/api/v1/rfid/check-ins")
        .set("authorization", "Bearer user-access-token")
        .send({
          eventId: randomUUID(),
          rfidUid: "CARD-1234",
        });

      expect(response.status).toBe(200);
      expect(received.authorization).toBe(
        "Bearer user-access-token",
      );
      expect(received.url).toBe("/api/v1/rfid/check-ins");
    } finally {
      await new Promise<void>((resolve, reject) => {
        upstream.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
