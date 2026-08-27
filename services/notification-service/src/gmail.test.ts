import { describe, expect, it, vi } from "vitest";

import {
  emailAllowed,
  loadGmailConfig,
  retryGmailOperation,
} from "./gmail.js";

describe("Gmail reporting configuration", () => {
  // Keeps Gmail off until the rollout flag is explicitly enabled.
  it("stays disabled by default", () => {
    expect(loadGmailConfig({ GOOGLE_GMAIL_ENABLED: "false" })).toBeNull();
  });

  // Rejects enabled Gmail delivery when an OAuth secret is missing.
  it("fails closed for incomplete OAuth configuration", () => {
    expect(() => loadGmailConfig({
      GOOGLE_GMAIL_ENABLED: "true",
    })).toThrow(/configuration is invalid/);
  });

  // Allows the school domain and explicit operator allowlist only.
  it("enforces recipient boundaries", () => {
    const allowlist = new Set(["auditor@partner.edu"]);
    expect(emailAllowed("admin@school.edu", "school.edu", allowlist)).toBe(true);
    expect(emailAllowed("auditor@partner.edu", "school.edu", allowlist)).toBe(true);
    expect(emailAllowed("outsider@partner.edu", "school.edu", allowlist)).toBe(false);
  });
});

describe("Gmail retry policy", () => {
  // Retries temporary provider failures with a bounded delay hook.
  it("retries 5xx responses", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue("message-id");
    await expect(
      retryGmailOperation(operation, async () => undefined),
    ).resolves.toBe("message-id");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  // Stops immediately when Gmail rejects permissions.
  it("does not retry 401 responses", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue({ response: { status: 401 } });
    await expect(
      retryGmailOperation(operation, async () => undefined),
    ).rejects.toMatchObject({
      code: "GMAIL_PERMISSION_OR_REQUEST_FAILURE",
      retryable: false,
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
