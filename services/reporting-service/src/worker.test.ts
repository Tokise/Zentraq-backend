import { describe, expect, it } from "vitest";

import { reportBatchSize } from "./worker.js";

describe("report worker batches", () => {
  // Keeps expensive workbook generation within the Free-demo budget.
  it("uses safe batch limits", () => {
    expect(reportBatchSize(undefined)).toBe(2);
    expect(reportBatchSize(-5)).toBe(1);
    expect(reportBatchSize(500)).toBe(2);
  });
});
