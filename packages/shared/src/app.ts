import express, { type Express } from "express";

import { requestContext, structuredRequestLog } from "./request.js";

// Creates the common safe Express foundation and non-sensitive health endpoint.
export function createServiceApp(service: string): Express {
  process.env.SERVICE_NAME = service;
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(requestContext);
  app.use(structuredRequestLog(service));
  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok", service });
  });
  return app;
}

// Starts one service on its configured port.
export function startService(app: Express, defaultPort: number, service: string): void {
  const port = Number(process.env.PORT ?? defaultPort);
  app.listen(port, () => {
    console.info(
      JSON.stringify({
        event: "service_started",
        port,
        service,
        timestamp: new Date().toISOString(),
      }),
    );
  });
}
