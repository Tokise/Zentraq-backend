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

const drainIntervalMs = Math.max(
  10_000,
  Number(process.env.REPORT_DRAIN_INTERVAL_MS ?? 30_000),
);

// Periodically recovers durable work without relying only on external Cron.
const reportDrainTimer = setInterval(() => {
  void Promise.all([
    drainReportJobs(2),
    drainReportDeliveryJobs(2),
  ]).catch(() => {
    console.error(
      JSON.stringify({
        code: "REPORT_PERIODIC_DRAIN_FAILED",
        event: "report_periodic_drain_failed",
      }),
    );
  });
}, drainIntervalMs);
reportDrainTimer.unref();

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
