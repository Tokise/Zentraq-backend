import { describe, expect, it } from "vitest";

import {
  buildReportStatusContract,
  normalizeJobStatus,
} from "./app.js";

describe("report job status", () => {
  // Normalizes internal worker states for stable frontend polling.
  it("maps terminal and active states to the public contract", () => {
    expect(normalizeJobStatus("queued")).toBe("queued");
    expect(normalizeJobStatus("processing")).toBe("processing");
    expect(normalizeJobStatus("completed")).toBe("succeeded");
    expect(normalizeJobStatus("dead_letter")).toBe("failed");
    expect(normalizeJobStatus("expired")).toBe("failed");
  });
});

describe("report status contract", () => {
  // Exposes readiness and a retry hint while work is active.
  it("marks processing reports as generating", () => {
    expect(buildReportStatusContract({
      artifact_expires_at: null,
      artifact_path: null,
      error_code: null,
      id: "report-id",
      status: "processing",
    }, "request-id")).toEqual({
      downloadReady: false,
      errorCode: null,
      id: "report-id",
      phase: "generating",
      requestId: "request-id",
      retryAfterMs: 1500,
      status: "processing",
    });
  });

  // Requires an unexpired artifact before the client attempts a download.
  it("marks a completed report with a current artifact as ready", () => {
    const result = buildReportStatusContract({
      artifact_expires_at: new Date(Date.now() + 60_000).toISOString(),
      artifact_path: "user/report/report.xlsx",
      error_code: null,
      id: "report-id",
      status: "completed",
    }, "request-id");
    expect(result.downloadReady).toBe(true);
    expect(result.phase).toBe("ready");
  });
});
