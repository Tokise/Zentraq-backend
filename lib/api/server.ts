import "server-only"

import { cookies } from "next/headers"

import { apiRequest, type ApiRequestOptions } from "@/lib/api/client"
import { createClient } from "@/utils/supabase/server"

// Calls the gateway from server code with the current Supabase access token.
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
    baseUrl: process.env.BACKEND_URL ?? "http://localhost:4000",
  })
}
