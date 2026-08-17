export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  accessToken: string
  baseUrl?: string
  body?: unknown
  headers?: HeadersInit
}

export interface ApiPagination {
  limit: number
  page: number
  total: number
  totalPages: number
}

interface ApiSuccess<T> {
  data: T
  pagination?: ApiPagination
  success: true
}

interface ApiFailure {
  error: {
    code: string
    message: string
  }
  success: false
}

export class ZentraqApiError extends Error {
  // Creates a typed public API error for UI and Server Action handling.
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ZentraqApiError"
  }
}

// Calls the same-origin API Gateway using an already-issued Supabase token.
export async function apiRequest<T>(
  path: `/api/v1/${string}`,
  options: ApiRequestOptions,
): Promise<{ data: T; pagination?: ApiPagination }> {
  const {
    accessToken,
    baseUrl = "",
    body,
    headers: inputHeaders,
    ...requestOptions
  } = options
  const headers = new Headers(inputHeaders)
  headers.set("accept", "application/json")
  headers.set("authorization", `Bearer ${accessToken}`)
  if (body !== undefined) headers.set("content-type", "application/json")

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let payload: ApiSuccess<T> | ApiFailure
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new ZentraqApiError(
      response.status || 502,
      "INVALID_API_RESPONSE",
      "The backend returned an invalid response.",
    )
  }
  if (!response.ok || !payload.success) {
    const code = payload.success ? "API_ERROR" : payload.error.code
    const message = payload.success
      ? "The request could not be completed."
      : payload.error.message
    throw new ZentraqApiError(response.status, code, message)
  }
  return { data: payload.data, pagination: payload.pagination }
}
