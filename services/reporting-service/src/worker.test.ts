import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  buildWorkbook,
  reportBatchSize,
  type ReportPayload,
} from "./worker.js";
import { deliveryBatchSize } from "./delivery-worker.js";

describe("report worker batches", () => {
  // Keeps expensive workbook generation within the Free-demo budget.
  it("uses safe batch limits", () => {
    expect(reportBatchSize(undefined)).toBe(2);
    expect(reportBatchSize(-5)).toBe(1);
    expect(reportBatchSize(500)).toBe(2);
  });
});

describe("monthly report workbook", () => {
  // Verifies every aggregate section has a summary and an embedded chart.
  it("includes monthly summaries, complete data tables, and charts", async () => {
    const payload: ReportPayload = {
      complaints: [
        { complaint: "Headache", frequency: 4 },
        { complaint: "Fever", frequency: 3 },
      ],
      daily: [
        {
          appointment_visits: 3,
          consultation_date: "2026-09-01",
          faculty_consultations: 2,
          rfid_visits: 4,
          student_consultations: 5,
          total_consultations: 7,
        },
        {
          appointment_visits: 4,
          consultation_date: "2026-09-02",
          faculty_consultations: 3,
          rfid_visits: 5,
          student_consultations: 6,
          total_consultations: 9,
        },
      ],
      dispensing: [
        {
          brand_name: "Example",
          category: "Analgesic",
          first_dispensed: "2026-09-01T01:00:00Z",
          generic_name: "Paracetamol",
          last_dispensed: "2026-09-02T02:00:00Z",
          medicine_id: "11111111-1111-4111-8111-111111111111",
          total_dispensed: 2,
          total_quantity_dispensed: 12,
        },
      ],
      overview: {
        active_incidents: 1,
        faculty_consultations: 5,
        low_stock_medicines: 2,
        pending_clearances: 3,
        period_end: "2026-09-30",
        period_start: "2026-09-01",
        student_consultations: 11,
        total_consultations: 16,
      },
      reportId: "22222222-2222-4222-8222-222222222222",
      requestedBy: "33333333-3333-4333-8333-333333333333",
    };

    const workbook = new ExcelJS.Workbook();
    const workbookBytes = await buildWorkbook(payload);
    await workbook.xlsx.load(
      workbookBytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Report Summary",
      "Daily Activity",
      "Visit Reasons",
      "Medicine Dispensing",
    ]);
    expect(workbook.getWorksheet("Report Summary")?.getImages()).toHaveLength(3);
    expect(workbook.getWorksheet("Daily Activity")?.getImages()).toHaveLength(1);
    expect(workbook.getWorksheet("Visit Reasons")?.getImages()).toHaveLength(1);
    expect(workbook.getWorksheet("Medicine Dispensing")?.getImages())
      .toHaveLength(1);
    expect(workbook.getWorksheet("Daily Activity")?.getCell("A1").value)
      .toBe("Consultation activity summary");
    expect(workbook.getWorksheet("Visit Reasons")?.getCell("A5").value)
      .toBe("Visit Reason");
    expect(workbook.getWorksheet("Medicine Dispensing")?.getCell("A5").value)
      .toBe("Generic Name");
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
