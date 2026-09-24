import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Reads one required environment value without logging its contents.
export function requiredEnvironment(name: string): string {
  let value = process.env[name];
  if (!value) {
    if (name === "SUPABASE_SECRET_KEY") {
      value = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;
    } else if (name === "SUPABASE_PUBLISHABLE_KEY") {
      value = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else if (name === "SUPABASE_URL") {
      value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  }
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

// Creates the service-only privileged Supabase client with sessions disabled.
export function createAdminClient(): SupabaseClient {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// Creates an unprivileged Auth client used only to validate Supabase user tokens.
export function createAuthClient(): SupabaseClient {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// Creates a request-scoped client that preserves the caller's RLS identity.
export function createUserClient(accessToken: string): SupabaseClient {
  if (!accessToken.trim()) {
    throw new Error("A user access token is required.");
  }
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}
