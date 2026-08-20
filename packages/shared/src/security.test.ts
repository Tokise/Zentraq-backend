import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  signInternalContext,
  verifyInternalContext,
} from "./security.js";

const secret = "a-secure-test-secret-that-is-longer-than-32-characters";

describe("signed internal context", () => {
  // Verifies a context only when its signature and request binding are intact.
  it("accepts a valid context", () => {
    const requestId = randomUUID();
    const context = {
      expiresAt: Date.now() + 30_000,
      requestId,
      roles: ["doctor" as const],
      userId: randomUUID(),
    };
    const signed = signInternalContext(context, secret);
    expect(
      verifyInternalContext(
        signed.payload,
        signed.signature,
        secret,
        requestId,
      ),
    ).toEqual(context);
  });

  // Rejects a signature produced with an untrusted secret.
  it("rejects a spoofed signature", () => {
    const requestId = randomUUID();
    const signed = signInternalContext(
      {
        expiresAt: Date.now() + 30_000,
        requestId,
        roles: ["admin"],
        userId: randomUUID(),
      },
      secret,
    );
    expect(() =>
      verifyInternalContext(
        signed.payload,
        signed.signature,
        "a-different-secret-that-is-also-long-enough",
        requestId,
      ),
    ).toThrow("Internal authorization failed");
  });
});
