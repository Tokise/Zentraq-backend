import { describe, expect, it } from "vitest";

import { reportBatchSize } from "./worker.js";
import { deliveryBatchSize } from "./delivery-worker.js";

describe("report worker batches", () => {
  // Keeps expensive workbook generation within the Free-demo budget.
  it("uses safe batch limits", () => {
    expect(reportBatchSize(undefined)).toBe(2);
    expect(reportBatchSize(-5)).toBe(1);
    expect(reportBatchSize(500)).toBe(2);
  });
});

describe("report delivery worker batches", () => {
  // Keeps Drive, Sheets, and Gmail delivery concurrency at two or fewer.
  it("uses safe delivery limits", () => {
    expect(deliveryBatchSize(undefined)).toBe(2);
    expect(deliveryBatchSize(-5)).toBe(1);
    expect(deliveryBatchSize(500)).toBe(2);
  });
});
