import { startService } from "@zentraq/shared";

import { createClinicalApp } from "./app.js";

startService(createClinicalApp(), 4002, "clinical-service");
