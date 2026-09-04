import { currentContext } from "./context.ts";

// Returns invalidation instructions for the thin Next.js action to apply.
export function updateTag(tag: string): void {
  currentContext().tags.add(tag);
}

// Collects affected pages without coupling domain code to Next.js runtime.
export function revalidatePath(path: string): void {
  currentContext().paths.add(path);
}

// Executes authorized live reads without shared patient-data caching.
export function unstable_cache<T extends (...args: never[]) => unknown>(
  read: T,
  _keys?: string[],
  _options?: unknown,
): T {
  return read;
}

// Registers noncritical effects with the Edge request lifetime.
export function after(effect: () => Promise<unknown>): void {
  currentContext().effects.push(effect);
}
