export const RFID_CHECK_IN_CHANNEL = "zentraq:rfid-check-in";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RfidCheckInCompletedEvent {
  type: "check-in-completed";
  queueEntryId: string;
}

// Creates the minimized cross-tab event emitted after a successful check-in.
export function createRfidCheckInCompletedEvent(
  queueEntryId: string,
): RfidCheckInCompletedEvent {
  return {
    type: "check-in-completed",
    queueEntryId,
  };
}

// Accepts only the expected event shape and a valid queue-entry identifier.
export function parseRfidCheckInCompletedEvent(
  value: unknown,
): RfidCheckInCompletedEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const type = Reflect.get(value, "type");
  const queueEntryId = Reflect.get(value, "queueEntryId");
  if (
    type !== "check-in-completed" ||
    typeof queueEntryId !== "string" ||
    !UUID_PATTERN.test(queueEntryId)
  ) {
    return null;
  }

  return { type, queueEntryId };
}
