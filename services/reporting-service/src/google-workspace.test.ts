import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  loadGoogleWorkspaceConfig,
  retryGoogleOperation,
} from "./google-workspace.js";

const validCredential = Buffer.from(JSON.stringify({
  client_email: "publisher@example-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  project_id: "example-project",
})).toString("base64");

describe("Google Workspace reporting configuration", () => {
  // Leaves the connector unavailable when the rollout flag is disabled.
  it("stays disabled without reading credentials", () => {
    expect(loadGoogleWorkspaceConfig({
      GOOGLE_DRIVE_ENABLED: "false",
    })).toBeNull();
  });

  // Fails startup when an enabled connector has incomplete secrets.
  it("rejects incomplete enabled configuration", () => {
    expect(() => loadGoogleWorkspaceConfig({
      GOOGLE_DRIVE_ENABLED: "true",
    })).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON_BASE64/);
  });

  // Accepts a complete service-account configuration without exposing its key.
  it("accepts complete scoped configuration", () => {
    const config = loadGoogleWorkspaceConfig({
      GOOGLE_ALLOWED_WORKSPACE_DOMAIN: "school.edu",
      GOOGLE_DRIVE_ENABLED: "true",
      GOOGLE_DRIVE_PRODUCTION_FOLDER_ID: "folder_identifier_123",
      GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: validCredential,
      GOOGLE_SHEETS_SPREADSHEET_ID: "spreadsheet_identifier_123",
    });
    expect(config?.allowedDomain).toBe("school.edu");
  });
});

describe("Google Workspace retry policy", () => {
  // Retries quota failures but stops after a successful bounded retry.
  it("retries 429 responses", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValue("ok");
    await expect(
      retryGoogleOperation(operation, async () => undefined),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  // Does not retry permanent permission failures.
  it("does not retry 403 responses", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue({ response: { status: 403 } });
    await expect(
      retryGoogleOperation(operation, async () => undefined),
    ).rejects.toMatchObject({
      code: "GOOGLE_PERMISSION_OR_REQUEST_FAILURE",
      retryable: false,
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
