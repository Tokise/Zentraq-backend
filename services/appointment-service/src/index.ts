import { startService } from "@zentraq/shared";

import { createAppointmentApp } from "./app.js";

startService(createAppointmentApp(), 4003, "appointment-service");
