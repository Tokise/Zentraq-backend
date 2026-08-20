import { describe, expect, it } from "vitest";

import { normalizeJobStatus } from "./app.js";

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
