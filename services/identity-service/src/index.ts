import { startService } from "@zentraq/shared";

import { createIdentityApp } from "./app.js";

startService(createIdentityApp(), 4001, "identity-service");
