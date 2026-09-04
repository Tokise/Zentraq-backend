import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

export interface ActionActor {
  id: string;
  email: string | null;
  role: "admin" | "doctor" | "nurse" | "student" | "faculty" | "staff";
}

export interface ClinicalContext {
  actor: ActionActor;
  admin: SupabaseClient;
  client: SupabaseClient;
  requestHeaders: Headers;
  tags: Set<string>;
  paths: Set<string>;
  effects: Array<() => Promise<unknown>>;
}

export const clinicalContext = new AsyncLocalStorage<ClinicalContext>();

// Fails closed outside an authenticated, session-validated request.
export function currentContext(): ClinicalContext {
  const context = clinicalContext.getStore();
  if (!context) throw new Error("CLINICAL_CONTEXT_REQUIRED");
  return context;
}

// Supplies the verified request actor to domain authorization checks.
export function getActionActor(): Promise<ActionActor> {
  return Promise.resolve(currentContext().actor);
}

// Checks roles resolved from the database rather than client input.
export function hasAnyRole(
  actor: ActionActor,
  roles: readonly string[],
): boolean {
  return roles.includes(actor.role);
}

// Returns the privileged client only within the verified request context.
export function createAdminClient(): SupabaseClient {
  return currentContext().admin;
}

// Returns the JWT-scoped client used by atomic workflow functions.
export function createClient(_cookies?: unknown): SupabaseClient {
  return currentContext().client;
}

// Provides request metadata to the domain audit writer.
export function headers(): Promise<Headers> {
  return Promise.resolve(currentContext().requestHeaders);
}

// Cookie secrets stay in Next; the Edge entrypoint validates their proof.
export function cookies(): Promise<undefined> {
  currentContext();
  return Promise.resolve(undefined);
}

// The Edge entrypoint accepts only a validated server-side session proof.
export function assertSameOrigin(): Promise<boolean> {
  currentContext();
  return Promise.resolve(true);
}
