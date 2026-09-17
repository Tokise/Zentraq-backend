interface PublicError {
  code: string;
  message: string;
}

// Returns a non-cacheable success envelope with request correlation.
export function successResponse(
  data: unknown,
  requestId: string,
  status = 200,
): Response {
  return Response.json(
    { data, success: true },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

// Returns a sanitized non-cacheable error envelope.
export function errorResponse(
  error: PublicError,
  status: number,
  requestId: string = crypto.randomUUID(),
): Response {
  return Response.json(
    { error, success: false },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}
