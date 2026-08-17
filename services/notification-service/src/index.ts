import { startService } from "@zentraq/shared";

import { createNotificationApp } from "./app.js";

startService(createNotificationApp(), 4005, "notification-service");
