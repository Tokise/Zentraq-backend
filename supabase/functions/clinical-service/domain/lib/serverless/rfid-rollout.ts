export interface RfidRolloutStatus {
  globallyEnabled: boolean;
  canaryRestricted: boolean;
  enabledForUser: boolean;
}

const RFID_ENABLED_ENV = "ZENTRAQ_SERVERLESS_RFID_ENABLED";
const RFID_CANARY_ENV = "ZENTRAQ_SERVERLESS_RFID_CANARY_IDS";

// Resolves a server-only rollout flag and its optional user allowlist.
export function isRfidEdgeEnabled(userId: string): boolean {
  if (Deno.env.get(RFID_ENABLED_ENV) !== "true") return false;

  const canaryIds = new Set(
    (Deno.env.get(RFID_CANARY_ENV) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return canaryIds.size === 0 || canaryIds.has(userId);
}

// Returns sanitized rollout state without revealing any canary identifiers.
export function getRfidRolloutStatus(userId: string): RfidRolloutStatus {
  const globallyEnabled = Deno.env.get(RFID_ENABLED_ENV) === "true";
  const canaryIds = new Set(
    (Deno.env.get(RFID_CANARY_ENV) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return {
    globallyEnabled,
    canaryRestricted: canaryIds.size > 0,
    enabledForUser: globallyEnabled &&
      (canaryIds.size === 0 || canaryIds.has(userId)),
  };
}
