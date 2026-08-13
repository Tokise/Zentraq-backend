"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  checkInRfidAction,
  type RfidCheckInResult,
} from "@/actions/rfid/check-in";
import { Input } from "@/components/ui/input";

const CONFIRMATION_DURATION_MS = 4000;

// Renders the layout-free patient RFID scanner display.
export default function PublicRfidScannerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rfidUid, setRfidUid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RfidCheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Returns focus to the input after each kiosk transition.
  const focusScanner = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Clears a completed scan before the next patient arrives.
  const resetScanner = useCallback(() => {
    setRfidUid("");
    setResult(null);
    setError(null);
    setSessionExpired(false);
    focusScanner();
  }, [focusScanner]);

  // Checks in the scanned patient through the server-side transaction.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rfidUid.trim() || isSubmitting || sessionExpired) return;

    setIsSubmitting(true);
    const response = await checkInRfidAction(rfidUid, crypto.randomUUID());
    setIsSubmitting(false);

    if (response.error || !response.result) {
      if (response.error === "Not authenticated") {
        setSessionExpired(true);
        return;
      }
      setError(response.error || "Unable to check in patient");
      setRfidUid("");
      focusScanner();
      return;
    }

    setResult(response.result);
    setRfidUid("");
  }

  useEffect(() => {
    focusScanner();
  }, [focusScanner]);

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(resetScanner, CONFIRMATION_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [resetScanner, result]);

  const photoUrl = result?.clinicPhotoUrl || "/student.png";
  const photoAlt = result
    ? `${result.firstName} ${result.lastName}`
    : "BCP Clinic mascot";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-xl bg-card p-10 shadow-sm">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="size-48 overflow-hidden bg-muted">
            <img
              src={photoUrl}
              alt={photoAlt}
              className="size-full object-cover"
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
            <>
              <div>
                <h1 className="text-3xl font-semibold">
                  Tap your ID to check in
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Please keep your card near the scanner.
                </p>
              </div>
            </>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-8">
          <Input
            ref={inputRef}
            value={rfidUid}
            onChange={(event) => setRfidUid(event.target.value)}
            placeholder="Tap card or type ID"
            className="h-14 text-center text-xl font-mono tracking-wider"
            autoComplete="off"
            disabled={sessionExpired}
            aria-describedby={error ? "rfid-error" : undefined}
          />
          {error && (
            <p
              id="rfid-error"
              role="alert"
              className="mt-3 text-center text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
