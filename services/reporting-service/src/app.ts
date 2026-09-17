export interface ReportStatusRow {
  artifact_expires_at: string | null;
  artifact_path: string | null;
  error_code: string | null;
  id: string;
  status: string;
}

// Maps worker-specific states to the stable public job contract.
export function normalizeJobStatus(
  status: string,
): "queued" | "processing" | "succeeded" | "failed" {
  if (status === "completed") return "succeeded";
  if (status === "dead_letter" || status === "expired") return "failed";
  return status === "processing" ? "processing" : "queued";
}

// Builds the stable polling contract without issuing a signed URL early.
export function buildReportStatusContract(
  status: ReportStatusRow,
  requestId: string,
) {
  const normalized = normalizeJobStatus(status.status);
  const artifactValid = Boolean(
    status.artifact_path &&
    status.artifact_expires_at &&
    new Date(status.artifact_expires_at).getTime() > Date.now(),
  );
  const downloadReady = normalized === "succeeded" && artifactValid;
  const artifactUnavailable = normalized === "succeeded" && !artifactValid;
  const phase = normalized === "processing"
    ? "generating"
    : normalized === "succeeded" && downloadReady
      ? "ready"
      : normalized === "failed" || artifactUnavailable
        ? "failed"
        : "queued";
  return {
    downloadReady,
    errorCode: artifactUnavailable
      ? status.error_code ?? "REPORT_ARTIFACT_UNAVAILABLE"
      : status.error_code,
    id: status.id,
    phase,
    requestId,
    retryAfterMs:
      phase === "queued" ? 1_000 : phase === "generating" ? 1_500 : null,
    status: artifactUnavailable ? "failed" : normalized,
  };
}
