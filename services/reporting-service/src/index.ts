import { startService } from "@zentraq/shared";

import { createReportingApp } from "./app.js";
import { drainReportDeliveryJobs } from "./delivery-worker.js";
import { drainReportJobs } from "./worker.js";

startService(createReportingApp(), 4006, "reporting-service");

// Resumes durable report work that was already queued before service startup.
setImmediate(() => {
  void drainReportJobs(2).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        code: "REPORT_STARTUP_DRAIN_FAILED",
        event: "report_startup_drain_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  });
});

// Resumes durable external deliveries without affecting private report startup.
setImmediate(() => {
  void drainReportDeliveryJobs(2).catch(() => {
    console.error(
      JSON.stringify({
        code: "REPORT_DELIVERY_STARTUP_DRAIN_FAILED",
        event: "report_delivery_startup_drain_failed",
      }),
    );
  });
});
