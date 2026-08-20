import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  // Creates a public-safe application error with an HTTP status and stable code.
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type AsyncRoute = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

// Converts rejected async route promises into Express errors.
export function asyncRoute(route: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction) => {
    void route(request, response, next).catch(next);
  };
}

// Returns a stable public error without leaking database or stack details.
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(400, "VALIDATION_ERROR", "The request is invalid.")
        : new AppError(500, "INTERNAL_ERROR", "The request could not be completed.");

  if (!(error instanceof AppError) && !(error instanceof ZodError)) {
    console.error(
      JSON.stringify({
        code: "UNHANDLED_ERROR",
        event: "request_failed",
        requestId: request.requestId,
        service: process.env.SERVICE_NAME ?? "unknown",
      }),
    );
  }

  response.status(appError.status).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
  });
};

// Produces a not-found error for unmatched service routes.
export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `No route matches ${request.method} ${request.path}.`,
    },
  });
}
