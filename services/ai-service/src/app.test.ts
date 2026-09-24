import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import worker from "./index.js";

describe("ai service worker", () => {
  it("returns 200 on /health", async () => {
    const request = new Request("https://ai.local/health");
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { service?: string; endpoints?: string[] };
    expect(body.service).toBe("ai-service");
    expect(body.endpoints).toContain("/api/v1/ai/ocr/scan");
    expect(body.endpoints).toContain("/api/v1/ai/appointments/auto-approve");
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
      data: { insights: Array<{ risk: string; daysOfStockRemaining?: number }> };
    };
    expect(body.source).toBe("fallback");
    expect(body.data.insights[0]?.risk).toBe("high");
    expect(body.data.insights[0]?.daysOfStockRemaining).toBe(2);
  });

  it("triggers emergency guardrail escalation for chest pain and shortness of breath", async () => {
    const clinicianId = randomUUID();
    const request = new Request("https://ai.local/api/v1/ai/appointments/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "severe chest pain and shortness of breath",
        availableSlots: [{ clinicianId, date: "2026-09-20", time: "09:00" }],
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      source: string;
      data: { priority: number; recommendedSlot: { clinicianId: string } };
    };
    expect(body.source).toBe("guardrail_escalation");
    expect(body.data.priority).toBe(5);
  });

  it("blocks automatic appointment approval when red-flag emergency symptoms are present", async () => {
    const clinicianId = randomUUID();
    const request = new Request("https://ai.local/api/v1/ai/appointments/auto-approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "Severe head injury and unconscious episode after a fall",
        availableClinicians: [
          { id: clinicianId, displayName: "Dr. Smith", role: "doctor", workload: 1, isAvailable: true },
        ],
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        autoApproved: boolean;
        priority: number;
        guardrailsStatus: string;
        redFlagsDetected: string[];
      };
    };
    expect(body.data.autoApproved).toBe(false);
    expect(body.data.priority).toBe(5);
    expect(body.data.guardrailsStatus).toBe("blocked_emergency");
    expect(body.data.redFlagsDetected).toContain("head injury");
  });

  it("auto-approves low-risk routine visit with available clinician", async () => {
    const clinicianId = randomUUID();
    const request = new Request("https://ai.local/api/v1/ai/appointments/auto-approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "Annual physical exam routine follow-up clearance",
        requestedTime: "10:00",
        availableClinicians: [
          { id: clinicianId, displayName: "Nurse Joy", role: "nurse", workload: 0, isAvailable: true },
        ],
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        autoApproved: boolean;
        priority: number;
        assignedClinicianId: string;
        guardrailsStatus: string;
      };
    };
    expect(body.data.autoApproved).toBe(true);
    expect(body.data.priority).toBe(1);
    expect(body.data.assignedClinicianId).toBe(clinicianId);
    expect(body.data.guardrailsStatus).toBe("passed");
  });

  it("extracts clinical facts from OCR scan text", async () => {
    const rawOcrText = `
      PATIENT CLINICAL WAIVER AND INTAKE
      Chief Complaint: Mild headache and seasonal allergy
      Vitals: BP: 120/80 mmHg, Temp: 36.6 C, HR: 74 bpm, SpO2: 99%
      Patient signature confirmed and consent signed.
    `;
    const request = new Request("https://ai.local/api/v1/ai/ocr/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawOcrText, documentType: "waiver" }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        blood_pressure?: string | null;
        temperature?: string | null;
        waiver_consent_signed?: boolean | null;
        summary: string;
      };
    };
    expect(body.data.blood_pressure).toBe("120/80");
    expect(body.data.waiver_consent_signed).toBe(true);
    expect(body.data.summary).toBeTruthy();
  });

  it("generates executive reporting insights from clinic totals", async () => {
    const request = new Request("https://ai.local/api/v1/ai/reports/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportTitle: "Q3 Campus Clinic Morbidity Census",
        totalVisits: 142,
        topComplaints: [
          { name: "Upper Respiratory Infection", count: 48 },
          { name: "Tension Headache", count: 25 },
        ],
        medicineDispensedCount: 310,
      }),
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        executiveSummary: string;
        keyInsights: string[];
        recommendations: string[];
      };
    };
    expect(body.data.executiveSummary).toContain("142");
    expect(body.data.keyInsights.length).toBeGreaterThanOrEqual(1);
    expect(body.data.recommendations.length).toBeGreaterThanOrEqual(1);
  });
});
