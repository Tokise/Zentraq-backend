import { startService } from "@zentraq/shared";

import { createReportingApp } from "./app.js";
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
