import { startService } from "@zentraq/shared";

import { createReportingApp } from "./app.js";

startService(createReportingApp(), 4006, "reporting-service");
