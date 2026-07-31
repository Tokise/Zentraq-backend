import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Creates an administrative Supabase client using the Service Role Key.
 * MUST ONLY be called in server-side code (Server Actions, Route Handlers, Server Components).
 * Protected by 'server-only' package to prevent accidental client-side inclusion.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE environment variable is missing from server environment.")
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
