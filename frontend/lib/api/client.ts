export interface ApiRequestOptions
  extends Omit<RequestInit, "body" | "headers"> {
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

// Calls the API Gateway with a Supabase token and retries only safe GET requests.
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
  const method = (requestOptions.method ?? "GET").toUpperCase()
  const attempts = method === "GET" ? 2 : 1

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await performRequest(
      path,
      {
        accessToken,
        baseUrl,
        body,
        headers: inputHeaders,
        ...requestOptions,
      },
    ).catch((error: unknown) => {
      if (attempt < attempts) return null
      throw error
    })
    if (!response) {
      await retryDelay()
      continue
    }
    if (
      attempt < attempts &&
      [502, 503, 504].includes(response.status)
    ) {
      await retryDelay()
      continue
    }
    return parseApiResponse<T>(response)
  }

  throw new ZentraqApiError(
    503,
    "BACKEND_UNAVAILABLE",
    "The backend is temporarily unavailable.",
  )
}

// Performs one bounded gateway request without mutation retries.
async function performRequest(
  path: `/api/v1/${string}`,
  options: ApiRequestOptions,
): Promise<Response> {
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
  headers.set("x-request-id", crypto.randomUUID())
  if (body !== undefined) headers.set("content-type", "application/json")

  try {
    return await fetch(
      `${baseUrl.replace(/\/$/, "")}${path}`,
      {
        ...requestOptions,
        cache: requestOptions.cache ?? "no-store",
        headers,
        body: body === undefined
          ? undefined
          : JSON.stringify(body),
        signal:
          requestOptions.signal ??
          AbortSignal.timeout(70_000),
      },
    )
  } catch {
    throw new ZentraqApiError(
      503,
      "BACKEND_UNAVAILABLE",
      "The backend is temporarily unavailable.",
    )
  }
}

// Parses the standard success or error envelope from the gateway.
async function parseApiResponse<T>(
  response: Response,
): Promise<{ data: T; pagination?: ApiPagination }> {
  let payload: ApiSuccess<T> | ApiFailure
  try {
    payload =
      (await response.json()) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new ZentraqApiError(
      response.status || 502,
      "INVALID_API_RESPONSE",
      "The backend returned an invalid response.",
    )
  }
  if (!response.ok || !payload.success) {
    const code = payload.success
      ? "API_ERROR"
      : payload.error.code
    const message = payload.success
      ? "The request could not be completed."
      : payload.error.message
    throw new ZentraqApiError(
      response.status,
      code,
      message,
    )
  }
  return {
    data: payload.data,
    pagination: payload.pagination,
  }
}

// Adds one short delay before retrying an idempotent GET.
async function retryDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600))
}
