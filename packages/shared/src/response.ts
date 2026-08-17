import type { Response } from "express";

import type { Pagination } from "./types.js";

// Sends the standard success envelope.
export function sendData<T>(response: Response, data: T, status = 200): void {
  response.status(status).json({ success: true, data });
}

// Sends a collection with server-calculated pagination metadata.
export function sendCollection<T>(
  response: Response,
  data: T[],
  pagination: Pagination,
): void {
  response.status(200).json({ success: true, data, pagination });
}
