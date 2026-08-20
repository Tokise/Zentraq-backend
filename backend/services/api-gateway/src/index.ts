import { startService } from "@zentraq/shared";

import { createGatewayApp } from "./app.js";

startService(createGatewayApp(), 4000, "api-gateway");
