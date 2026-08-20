import { describe, expect, it } from "vitest";

import { notificationBatchSize } from "./worker.js";

describe("notification worker batches", () => {
  // Bounds empty, negative, and oversized queue-drain requests.
  it("uses safe batch limits", () => {
    expect(notificationBatchSize(undefined)).toBe(10);
    expect(notificationBatchSize(-5)).toBe(1);
    expect(notificationBatchSize(500)).toBe(20);
  });
});
