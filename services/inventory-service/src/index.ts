import { startService } from "@zentraq/shared";

import { createInventoryApp } from "./app.js";

startService(createInventoryApp(), 4004, "inventory-service");
