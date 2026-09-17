import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import worker from "./index.js";

describe("ai service worker", () => {
  it("returns 200 on /health", async () => {
    const request = new Request("https://ai.local/health");
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { service?: string };
    expect(body.service).toBe("ai-service");
  });

  it("returns 400 on empty items for inventory insights", async () => {
    const request = new Request("https://ai.local/api/v1/ai/inventory/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(400);
  });

  it("keeps inventory guidance available without an AI provider (fallback)", async () => {
    const request = new Request("https://ai.local/api/v1/ai/inventory/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            averageDailyUse: 5,
            currentStock: 10,
            medicineId: randomUUID(),
          },
        ],
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      source: string;
      data: { insights: Array<{ risk: string }> };
    };
    expect(body.source).toBe("fallback");
    expect(body.data.insights[0]?.risk).toBe("high");
  });

  it("returns deterministic appointment fallback recommendation", async () => {
    const clinicianId = randomUUID();
    const request = new Request("https://ai.local/api/v1/ai/appointments/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "severe chest pain and shortness of breath",
        availableSlots: [
          { clinicianId, date: "2026-09-20", time: "09:00" },
        ],
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      source: string;
      data: { priority: number; recommendedSlot: { clinicianId: string } };
    };
    expect(body.source).toBe("fallback");
    expect(body.data.priority).toBe(5);
    expect(body.data.recommendedSlot.clinicianId).toBe(clinicianId);
  });
});
