import "server-only"

import { cookies } from "next/headers"

import {
  apiRequest,
  type ApiRequestOptions,
} from "@/lib/api/client"
import { createClient } from "@/utils/supabase/server"

// Resolves the server-only gateway URL with a safe local fallback.
function backendUrl(): string {
  const configured = process.env.BACKEND_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BACKEND_URL is required in production.",
    )
  }
  return "http://localhost:4000"
}

// Calls the gateway with the current Supabase access token.
export async function authenticatedApiRequest<T>(
  path: `/api/v1/${string}`,
  options: Omit<ApiRequestOptions, "accessToken"> = {},
) {
  const supabase = createClient(await cookies())
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error("Authentication is required.")
  }
  return apiRequest<T>(path, {
    ...options,
    accessToken: session.access_token,
    baseUrl: backendUrl(),
  })
}
