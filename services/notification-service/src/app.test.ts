import { describe, expect, it } from "vitest";

import { normalizeJobStatus } from "./app.js";

describe("notification job status", () => {
  // Normalizes internal worker states without exposing queue implementation names.
  it("maps terminal and active states to the public contract", () => {
    expect(normalizeJobStatus("queued")).toBe("queued");
    expect(normalizeJobStatus("processing")).toBe("processing");
    expect(normalizeJobStatus("completed")).toBe("succeeded");
    expect(normalizeJobStatus("dead_letter")).toBe("failed");
  });
});
