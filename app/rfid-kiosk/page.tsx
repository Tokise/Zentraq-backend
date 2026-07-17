"use client"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

type KioskMode = "SCAN" | "DISPLAY" | "UNREGISTERED"

interface PatientProfile {
  id: string
  rfid_uid: string
  first_name: string
  last_name: string
  clinic_photo_url: string | null
  student_number: string | null
  employee_number: string | null
  department: string | null
}

export default function RfidKioskPage() {
  const [kioskState, setKioskState] = useState<KioskMode>("SCAN")
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [rfidUid, setRfidUid] = useState("")
  const [rfidInput, setRfidInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [displayTimer, setDisplayTimer] = useState<number | null>(null)
  const [erasing, setErasing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  // Auto-focus input when in SCAN mode
  useEffect(() => {
    if (kioskState === "SCAN" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [kioskState])

  // Display timer: 5s display then 3s erase animation then reset
  useEffect(() => {
    if (displayTimer === null) return

    if (displayTimer <= 0) {
      if (!erasing) {
        // Start 3s erase phase
        setErasing(true)
        setDisplayTimer(0.5)
      } else {
        // Done erasing, reset
        resetScanner()
      }
      return
    }

    const interval = setInterval(() => {
      setDisplayTimer((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearInterval(interval)
  }, [displayTimer, erasing])

  // Global keyboard: Escape resets
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
    setKioskState("SCAN")
    setProfile(null)
    setRfidUid("")
    setRfidInput("")
    setDisplayTimer(null)
    setErasing(false)
    // Re-focus input after reset
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const uid = rfidInput.trim()
    if (!uid || loading) return

    setLoading(true)
    setRfidUid(uid)

    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .select("*")
        .eq("rfid_uid", uid)
        .maybeSingle()

      if (error) throw error

      if (data) {
        // Insert check-in consultation
        const fullName = `${data.first_name} ${data.last_name}`
        await supabase.from("consultations").insert({
          profile_id: data.id,
          patient_name: fullName,
          chief_complaint: "Routine Check-in (RFID Kiosk)",
          status: "active"
        })

        setProfile(data as PatientProfile)
        setKioskState("DISPLAY")
        setDisplayTimer(0.5) // 5s display, then 3s erase
        setErasing(false)
      } else {
        setKioskState("UNREGISTERED")
        setDisplayTimer(5)
        setErasing(false)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Check-in failed")
      resetScanner()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex items-center justify-center p-6 select-none">
      <Card className="w-full max-w-md border border-zinc-200/80 shadow-md bg-white overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-10 px-8 text-center space-y-6">
          {/* Header — always visible */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Zentraq Clinic</h1>
            <p className="text-xs text-zinc-400">Student & Staff Check-in Terminal</p>
          </div>

          {/* SCAN STATE: Input field */}
          {kioskState === "SCAN" && (
            <div className="w-full space-y-5 animate-in fade-in duration-200">
              <form onSubmit={handleScan} className="w-full space-y-3">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-medium text-zinc-500">Scan or enter your RFID Card ID</label>
                  <Input
                    ref={inputRef}
                    value={rfidInput}
                    onChange={(e) => setRfidInput(e.target.value)}
                    placeholder="Tap card or type ID here..."
                    className="h-12 text-center text-base font-mono tracking-wider"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Place your card on the reader. The ID will auto-fill and submit. If your card is not linked, please approach the registration desk.
                </p>
              </form>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Ready
              </div>
            </div>
          )}

          {/* DISPLAY STATE: Student info */}
          {kioskState === "DISPLAY" && profile && (
            <div
              className={`w-full space-y-5 transition-opacity duration-[2500ms] ${erasing ? "opacity-0" : "opacity-100"
                }`}
            >
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="size-24 rounded-full border-2 border-zinc-200 bg-white shadow-sm">
                  <AvatarImage
                    src={profile.clinic_photo_url || ""}
                    alt={`${profile.first_name} ${profile.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl font-bold bg-zinc-100 text-zinc-600">
                    {profile.first_name[0]}{profile.last_name[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-zinc-900">
                    {profile.first_name} {profile.last_name}
                  </h2>
                  <p className="text-sm font-mono text-zinc-500">
                    {profile.student_number || profile.employee_number || "—"}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="size-1.5 rounded-full bg-emerald-600" />
                Check-in logged
              </div>
            </div>
          )}

          {/* UNREGISTERED STATE */}
          {kioskState === "UNREGISTERED" && (
            <div
              className={`w-full space-y-4 transition-opacity duration-[2500ms] ${erasing ? "opacity-0" : "opacity-100"
                }`}
            >
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-zinc-800">Card not linked</p>
                <p className="text-xs text-zinc-400">
                  <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700 font-semibold">{rfidUid}</code>
                </p>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-[300px] mx-auto">
                Please approach the clinic registration desk so the operator can link your card.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
