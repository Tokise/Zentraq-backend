"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { TypeAnimation } from "react-type-animation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createConsultation as createConsultationAction, getKioskStudentProfile } from "@/actions/rfid/kiosk"

type KioskMode = "IDLE" | "DISPLAY" | "UNREGISTERED"

interface PatientProfile {
  id: string
  firstName: string
  lastName: string
  studentNumber: string | null
  employeeNumber: string | null
  department: string | null
  clinicPhotoUrl: string | null
}

export default function RfidKioskPage() {
  const [kioskState, setKioskState] = useState<KioskMode>("IDLE")
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [rfidUid, setRfidUid] = useState("")
  const [rfidInput, setRfidInput] = useState("")
  const [loading, setLoading] = useState(false)
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Always keep the scan input focused so the kiosk is ready for the next tap
  useEffect(() => {
    inputRef.current?.focus()
  }, [kioskState])

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    }
  }, [])

  // Global keyboard: Escape resets back to idle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetScanner()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function resetScanner() {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    setKioskState("IDLE")
    setProfile(null)
    setRfidUid("")
    setRfidInput("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Snaps the kiosk back to idle after a few seconds â€” instant, no animation.
  function scheduleAutoClear() {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    clearTimeoutRef.current = setTimeout(() => {
      setKioskState("IDLE")
      setProfile(null)
      setRfidUid("")
    }, 5000)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const uid = rfidInput.trim()
    if (!uid || loading) return

    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    setLoading(true)
    setRfidUid(uid)
    setRfidInput("")

    try {
      // Server Action handles: input validation, authorization, admin client lookup, data minimization
      const result = await getKioskStudentProfile(uid)

      if (result.error) {
        toast.error(result.error)
        resetScanner()
        return
      }

      if (result.profile) {
        const p = result.profile
        const fullName = `${p.firstName} ${p.lastName}`
        const consultResult = await createConsultationAction(p.id, fullName, "Routine Check-in (RFID Kiosk)")
        if (consultResult.error) {
          toast.error(consultResult.error)
          resetScanner()
          return
        }

        setProfile(p as unknown as PatientProfile)
        setKioskState("DISPLAY")
        scheduleAutoClear()
      } else {
        setProfile(null)
        setKioskState("UNREGISTERED")
        scheduleAutoClear()
      }
    } catch (err: any) {
      toast.error(err.message || "Check-in failed")
      resetScanner()
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex items-center justify-center p-5 select-none">
      <Card className="w-full max-w-2xl border border-zinc-200/80 shadow-md bg-white overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-10 px-8 text-center space-y-6">
          {/* Top Header Logos inside container */}
          <div className="w-full flex justify-between items-center mb-5 mt-[-40px]">
            <Image
              src="/4.png"
              alt="Zentraq Logo"
              width={180}
              height={96}
              className="h-15 w-auto object-contain"
            />
            <Image
              src="/logo.png"
              alt="School Logo"
              width={80}
              height={80}
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Header â€” subtitle types/deletes/cycles via react-type-animation */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Clinic Management System</h1>
            <div className="text-xs text-zinc-400 h-4">
              <TypeAnimation
                sequence={[
                  "Tap Your ID to Check In",
                  1500,
                  "Fast & Contactless",
                  1500,
                  "Student & Staff Check-in Terminal",
                  1500,
                  "Scan Now to Begin",
                  1500,
                ]}
                wrapper="span"
                speed={60}
                deletionSpeed={70}
                repeat={Infinity}
                cursor={true}
              />
            </div>
          </div>

          {/* Photo â€” always the same size, regardless of state â€” now a large box instead of a circle */}
          <div className="relative">
            <div className="size-50 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-zinc-100 flex items-center justify-center">
              {profile?.clinicPhotoUrl ? (
                <img
                  src={profile.clinicPhotoUrl}
                  alt="Student Profile"
                  className="size-full object-cover"
                />
              ) : profile ? (
                <span className="text-3xl font-bold bg-zinc-200 text-zinc-400 size-full flex items-center justify-center">
                  {profile.firstName[0]}{profile.lastName[0]}
                </span>
              ) : (
                <img
                  src="/student.png"
                  alt="Student Profile"
                  className="size-full object-cover"
                />
              )}
            </div>
          </div>

          {/* ID â€” directly under the picture */}
          <div className="min-h-[20px] flex items-center justify-center">
            {kioskState === "DISPLAY" && profile && (
              <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-2xl text-zinc-600 font-semibold tracking-wide">
                {profile.studentNumber || profile.employeeNumber || "â€”"}
              </code>
            )}
            {kioskState === "UNREGISTERED" && (
              <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-xs text-zinc-700 font-semibold tracking-wide">
                {rfidUid}
              </code>
            )}

          </div>

          {/* Name â€” directly under the picture */}
          <div className="min-h-[20px] flex items-center justify-center">
            {kioskState === "DISPLAY" && profile && (
              <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-2xl text-zinc-600 font-semibold tracking-wide">
                {profile.firstName} {profile.lastName}
              </code>
            )}
          </div>

          {/* Scan input â€” same field, always present, so the next tap works instantly */}
          <form onSubmit={handleScan} className="w-80 space-y-1">
            <Input
              ref={inputRef}
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              placeholder="Tap card or type ID here..."
              className="h-12 text-center text-2xl font-mono tracking-wider"
              autoFocus
              autoComplete="off"
            />
          </form>

          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] mb-[-50px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
            {kioskState === "DISPLAY" ? "Check-in logged" : "Ready"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}