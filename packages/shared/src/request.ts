import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Assigns a trusted UUID request ID and captures request timing.
export function requestContext(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const inbound = request.header("x-request-id");
  request.requestId =
    inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : randomUUID();
  request.startedAt = Date.now();
  response.setHeader("x-request-id", request.requestId);
  next();
}

// Emits one sanitized structured log after a request completes.
export function structuredRequestLog(service: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    response.on("finish", () => {
      console.info(
        JSON.stringify({
          duration: Date.now() - request.startedAt,
          requestId: request.requestId,
          route: request.path,
          service,
          status: response.statusCode,
          timestamp: new Date().toISOString(),
          userId: request.auth?.userId,
        }),
      );
    });
    next();
  };
}
