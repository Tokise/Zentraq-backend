import { startService } from "@zentraq/shared";

import { createNotificationApp } from "./app.js";
import { drainNotificationJobs } from "./worker.js";

startService(createNotificationApp(), 4005, "notification-service");

// Resumes durable notification work that was queued before service startup.
setImmediate(() => {
  void drainNotificationJobs(10).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        code: "NOTIFICATION_STARTUP_DRAIN_FAILED",
        event: "notification_startup_drain_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  });
});
