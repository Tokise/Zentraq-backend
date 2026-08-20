import { startService } from "@zentraq/shared";

import { createAiApp } from "./app.js";

startService(createAiApp(), 4007, "ai-service");
