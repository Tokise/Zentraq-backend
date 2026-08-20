"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, RotateCcw } from "lucide-react";

import {
  checkInRfidAction,
  type RfidCheckInResult,
} from "@/actions/rfid/check-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRfidCheckInCompletedEvent,
  RFID_CHECK_IN_CHANNEL,
} from "@/lib/rfid/check-in-events";

interface RetryAttempt {
  eventId: string;
  rfidUid: string;
}

// Renders the layout-free patient RFID scanner display.
export default function PublicRfidScannerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const checkInChannelRef = useRef<BroadcastChannel | null>(null);
  const [rfidUid, setRfidUid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState<RetryAttempt | null>(null);
  const [result, setResult] = useState<RfidCheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Returns focus to the input after each kiosk transition.
  const focusScanner = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Submits one idempotent RFID event and preserves it for explicit retry.
  async function submitCheckIn(attempt: RetryAttempt) {
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    const response = await checkInRfidAction(
      attempt.rfidUid,
      attempt.eventId,
    );
    setIsSubmitting(false);

    if (response.error || !response.result) {
      if (response.error === "Not authenticated") {
        setSessionExpired(true);
        return;
      }
      const message = response.error || "Unable to check in patient";
      setError(message);
      setRetryAttempt(
        message === "RFID check-in is temporarily unavailable"
          ? attempt
          : null,
      );
      setRfidUid("");
      focusScanner();
      return;
    }

    setRetryAttempt(null);
    setResult(response.result);
    setRfidUid("");
    checkInChannelRef.current?.postMessage(
      createRfidCheckInCompletedEvent(response.result.queueEntryId),
    );
    focusScanner();
  }

  // Starts a new RFID event from the scanner or keyboard form.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rfidUid.trim() || isSubmitting || sessionExpired) return;
    await submitCheckIn({
      eventId: crypto.randomUUID(),
      rfidUid: rfidUid.trim(),
    });
  }

  // Retries only the failed RFID event with its original idempotency key.
  async function handleRetry() {
    if (!retryAttempt || isSubmitting) return;
    await submitCheckIn(retryAttempt);
  }

  useEffect(() => {
    focusScanner();
  }, [focusScanner]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(RFID_CHECK_IN_CHANNEL);
    checkInChannelRef.current = channel;

    return () => {
      checkInChannelRef.current = null;
      channel.close();
    };
  }, []);

  const photoUrl = result?.clinicPhotoUrl || "/student.png";
  const photoAlt = result
    ? `${result.firstName} ${result.lastName}`
    : "BCP Clinic mascot";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-xl bg-card p-10 shadow-sm">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative size-48 overflow-hidden bg-muted">
            <Image
              src={photoUrl}
              alt={photoAlt}
              fill
              sizes="192px"
              className="object-cover"
              unoptimized
            />
          </div>
          {result ? (
            <>
              <CheckCircle2
                className="size-10 text-success"
                aria-hidden="true"
              />
              <div>
                <h1 className="text-3xl font-semibold">
                  {result.firstName} {result.lastName}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {result.createdNew
                    ? "You are checked in."
                    : "You are already checked in."}
                </p>
              </div>
            </>
          ) : sessionExpired ? (
            <div>
              <h1 className="text-3xl font-semibold">Scanner paused</h1>
              <p className="mt-2 text-muted-foreground">
                A clinic operator must sign in again before check-in can
                continue.
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-semibold">
                Tap your ID to check in
              </h1>
              <p className="mt-2 text-muted-foreground">
                Please keep your card near the scanner.
              </p>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-8">
          <Input
            ref={inputRef}
            value={rfidUid}
            onChange={(event) => setRfidUid(event.target.value)}
            placeholder="Tap card or type ID"
            className="h-14 text-center font-mono text-xl tracking-wider"
            autoComplete="off"
            disabled={sessionExpired || isSubmitting}
            aria-describedby={error ? "rfid-error" : "rfid-status"}
          />
          <div
            id="rfid-status"
            role="status"
            aria-live="polite"
            className="mt-3 min-h-6 text-center text-sm text-muted-foreground"
          >
            {isSubmitting ? "Checking in…" : null}
          </div>
          {error && (
            <div className="mt-3 text-center">
              <p
                id="rfid-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
              {retryAttempt && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 min-h-11"
                  onClick={handleRetry}
                  disabled={isSubmitting}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Retry same check-in
                </Button>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
