import "server-only"

export type ServerlessFeature = "notifications" | "reports" | "rfid"

export interface ServerlessFeatureStatus {
  globallyEnabled: boolean
  canaryRestricted: boolean
  enabledForUser: boolean
}

const FEATURE_ENV: Record<ServerlessFeature, string> = {
  notifications: "ZENTRAQ_SERVERLESS_NOTIFICATIONS_ENABLED",
  reports: "ZENTRAQ_SERVERLESS_REPORTS_ENABLED",
  rfid: "ZENTRAQ_SERVERLESS_RFID_ENABLED",
}

const CANARY_ENV: Record<ServerlessFeature, string> = {
  notifications: "ZENTRAQ_SERVERLESS_NOTIFICATIONS_CANARY_IDS",
  reports: "ZENTRAQ_SERVERLESS_REPORTS_CANARY_IDS",
  rfid: "ZENTRAQ_SERVERLESS_RFID_CANARY_IDS",
}

// Resolves a server-only rollout flag and its optional user allowlist.
export function isServerlessFeatureEnabled(
  feature: ServerlessFeature,
  userId: string,
): boolean {
  if (process.env[FEATURE_ENV[feature]] !== "true") return false

  const canaryIds = new Set(
    (process.env[CANARY_ENV[feature]] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )

  return canaryIds.size === 0 || canaryIds.has(userId)
}

// Returns sanitized rollout state without revealing any canary identifiers.
export function getServerlessFeatureStatus(
  feature: ServerlessFeature,
  userId: string,
): ServerlessFeatureStatus {
  const globallyEnabled = process.env[FEATURE_ENV[feature]] === "true"
  const canaryIds = new Set(
    (process.env[CANARY_ENV[feature]] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )

  return {
    globallyEnabled,
    canaryRestricted: canaryIds.size > 0,
    enabledForUser:
      globallyEnabled &&
      (canaryIds.size === 0 || canaryIds.has(userId)),
  }
}
