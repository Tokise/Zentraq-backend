import { startService } from "@zentraq/shared";

import { createNotificationApp } from "./app.js";
import { drainNotificationJobs } from "./worker.js";

startService(createNotificationApp(), 4005, "notification-service");

let draining = false;

// Recovers durable notices after transient errors without overlapping local batches.
const noticeTimer = setInterval(async () => {
  if (draining) return;
  draining = true;
  try {
    await drainNotificationJobs(10);
  } catch {
    console.error(JSON.stringify({ event: "notification_periodic_drain_failed" }));
  } finally {
    draining = false;
  }
}, 15_000);
noticeTimer.unref();

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
