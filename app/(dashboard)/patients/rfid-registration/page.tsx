"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
  Camera,
  CameraOff,
  Check,
  RefreshCw,
  RotateCcw,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon
} from "lucide-react"

type PageMode = "WIZARD" | "VERIFIED" | "SUCCESS"

interface PatientProfile {
  id: string
  rfid_uid: string
  first_name: string
  last_name: string
  email: string | null
  department: string | null
  course: string | null
  year_level: string | null
  position: string | null
  student_number: string | null
  employee_number: string | null
  clinic_photo_url: string | null
  active_status: boolean
}

const STEPS = ["Scan Card", "Student Info", "Profile Photo", "Review"]

export default function RfidRegistrationPage() {
  const [mode, setMode] = useState<PageMode>("WIZARD")
  const [step, setStep] = useState(1)
  const [rfidUid, setRfidUid] = useState("")
  const [searchedProfile, setSearchedProfile] = useState<PatientProfile | null>(null)

  // Form
  const [role, setRole] = useState<"student" | "faculty" | "staff">("student")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("")
  const [course, setCourse] = useState("")
  const [yearLevel, setYearLevel] = useState("")
  const [position, setPosition] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)

  // UI
  const [loading, setLoading] = useState(false)
  const [resetTimer, setResetTimer] = useState<number | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Refs
  const rfidInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const supabase = createClient()

  // Auto-focus RFID input on step 1
  useEffect(() => {
    if (mode === "WIZARD" && step === 1 && rfidInputRef.current) {
      rfidInputRef.current.focus()
    }
  }, [mode, step])

  // Cleanup camera when leaving step 3
  useEffect(() => {
    if (!(mode === "WIZARD" && step === 3)) {
      stopCamera()
    }
  }, [mode, step])

  // Auto-reset timer for verified/success screens
  useEffect(() => {
    if (resetTimer === null) return
    if (resetTimer <= 0) { resetScanner(); return }
    const interval = setInterval(() => {
      setResetTimer((p) => (p !== null ? p - 1 : null))
    }, 1000)
    return () => clearInterval(interval)
  }, [resetTimer])

  // Global escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") resetScanner() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function resetScanner() {
    setMode("WIZARD")
    setStep(1)
    setRfidUid("")
    setSearchedProfile(null)
    setResetTimer(null)
    setFirstName(""); setLastName(""); setIdNumber(""); setEmail("")
    setDepartment(""); setCourse(""); setYearLevel(""); setPosition("")
    setPhoto(null)
    setRole("student")
  }

  // Step 1: Scan/lookup
  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault()
    const uid = rfidUid.trim()
    if (!uid) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .select("*")
        .eq("rfid_uid", uid)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setSearchedProfile(data as PatientProfile)
        setMode("VERIFIED")
        setResetTimer(8)
        toast.success(`Profile already registered for ${data.first_name}`)
      } else {
        setStep(2)
        toast.info("Card not registered. Fill in student details to continue.")
      }
    } catch (err: any) {
      toast.error(err.message || "Lookup failed")
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Validate form and go to step 3
  function handleInfoNext(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName || !idNumber) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (role === "student" && !course) {
      toast.error("Course is required for students.")
      return
    }
    if (role !== "student" && !position) {
      toast.error("Position is required for faculty/staff.")
      return
    }
    setStep(3)
    startCamera()
  }

  // Webcam
  async function startCamera() {
    try {
      setCameraActive(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: "user" }, audio: false
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraActive(false)
      toast.error("Camera access denied. Use the file upload option.")
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    canvas.width = 200; canvas.height = 200
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200)
    setPhoto(canvas.toDataURL("image/jpeg", 0.7))
    stopCamera()
    toast.success("Photo captured!")
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const img = new Image()
      img.src = reader.result as string
      img.onload = () => {
        const c = document.createElement("canvas")
        c.width = 200; c.height = 200
        const ctx = c.getContext("2d")
        if (!ctx) return
        const size = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200)
        setPhoto(c.toDataURL("image/jpeg", 0.7))
        toast.success("Photo uploaded!")
      }
    }
    reader.readAsDataURL(file)
  }

  // Step 4: Submit
  async function handleRegister() {
    if (!rfidUid) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .insert({
          rfid_uid: rfidUid,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          department: department || null,
          course: role === "student" ? course : null,
          year_level: role === "student" ? yearLevel : null,
          position: role !== "student" ? position : null,
          student_number: role === "student" ? idNumber : null,
          employee_number: role !== "student" ? idNumber : null,
          clinic_photo_url: photo || null,
          active_status: true
        })
        .select()
        .single()

      if (error) throw error
      toast.success("Profile registered and RFID linked!")
      setSearchedProfile(data as PatientProfile)
      setMode("SUCCESS")
      setResetTimer(8)
    } catch (err: any) {
      toast.error(err.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto px-4 py-4">
      <PageHeader
        title="RFID Registration"
        description="Link physical RFID cards to student and employee clinic profiles."
      />

      {/* Subtle step indicator — only during wizard */}
      {mode === "WIZARD" && (
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((label, i) => {
            const stepNum = i + 1
            const isActive = step === stepNum
            const isDone = step > stepNum
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <div className={`w-8 h-px mx-1 ${isDone ? "bg-zinc-400" : "bg-zinc-200"}`} />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                      isDone
                        ? "bg-zinc-800 text-white"
                        : isActive
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                    }`}
                  >
                    {isDone ? <Check className="size-3" /> : stepNum}
                  </div>
                  <span className={`text-[9px] ${isActive || isDone ? "text-zinc-600 font-medium" : "text-zinc-300"}`}>
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── STEP 1: RFID Input ─── */}
      {mode === "WIZARD" && step === 1 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-zinc-900">Scan or Enter RFID</h2>
              <p className="text-xs text-zinc-400">Tap the card on the desk reader or type the UID manually</p>
            </div>
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <Input
                ref={rfidInputRef}
                value={rfidUid}
                onChange={(e) => setRfidUid(e.target.value)}
                placeholder="Card UID..."
                className="h-12 text-center font-mono tracking-widest text-base"
                autoFocus
                autoComplete="off"
              />
              <Button
                type="submit"
                disabled={loading || !rfidUid.trim()}
                className="w-full h-10 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {loading ? <RefreshCw className="size-4 animate-spin mr-1.5" /> : null}
                {loading ? "Searching..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 2: Info Form ─── */}
      {mode === "WIZARD" && step === 2 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Student Details</CardTitle>
            <CardDescription className="text-xs">
              Card: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700 font-semibold">{rfidUid}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInfoNext} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <select
                  value={role}
                  onChange={(e) => { setRole(e.target.value as any); setCourse(""); setYearLevel(""); setPosition("") }}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">First Name <span className="text-red-500">*</span></Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Last Name <span className="text-red-500">*</span></Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-9" />
                </div>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{role === "student" ? "Student No." : "Employee No."} <span className="text-red-500">*</span></Label>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="2023-01049" required className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@school.edu" className="h-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="College of Engineering" className="h-9" />
              </div>

              {role === "student" && (
                <div className="grid gap-3 grid-cols-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Course <span className="text-red-500">*</span></Label>
                    <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BS Info Tech" required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Year</Label>
                    <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="w-full h-9 px-2 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none">
                      <option value="">—</option>
                      <option value="1">1st</option>
                      <option value="2">2nd</option>
                      <option value="3">3rd</option>
                      <option value="4">4th</option>
                    </select>
                  </div>
                </div>
              )}

              {role !== "student" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Position <span className="text-red-500">*</span></Label>
                  <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Lab Technician" required className="h-9" />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-zinc-100">
                <Button type="button" variant="outline" size="sm" onClick={resetScanner}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-1">
                  Next <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 3: Photo Capture ─── */}
      {mode === "WIZARD" && step === 3 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Profile Photo</CardTitle>
            <CardDescription className="text-xs">Capture or upload a photo for {firstName} {lastName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center space-y-4">
              {/* Circular frame */}
              <div className="relative size-48 rounded-full overflow-hidden border-2 border-zinc-200 bg-zinc-50 flex items-center justify-center shadow-inner">
                {photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="size-full object-cover scale-x-[-1]" />
                ) : (
                  <CameraOff className="size-10 text-zinc-300" />
                )}
                {cameraActive && !photo && (
                  <div className="absolute inset-5 rounded-full border border-dashed border-white/60 pointer-events-none" />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" width="200" height="200" />

              {/* Controls */}
              <div className="flex flex-wrap justify-center gap-2">
                {!photo && !cameraActive && (
                  <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                    <Camera className="size-3.5 mr-1" /> Start Camera
                  </Button>
                )}
                {cameraActive && !photo && (
                  <Button type="button" size="sm" onClick={capturePhoto} className="bg-zinc-900 text-white hover:bg-zinc-800">
                    <Check className="size-3.5 mr-1" /> Capture
                  </Button>
                )}
                {photo && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPhoto(null); startCamera() }}>
                    <RotateCcw className="size-3.5 mr-1" /> Retake
                  </Button>
                )}
                {cameraActive && (
                  <Button type="button" variant="ghost" size="sm" onClick={stopCamera} className="text-red-500 hover:bg-red-50">
                    Cancel
                  </Button>
                )}
              </div>

              {/* File upload fallback */}
              <div className="text-center">
                <input type="file" accept="image/*" id="photo-upload" onChange={handlePhotoUpload} className="hidden" />
                <label htmlFor="photo-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-200 cursor-pointer hover:bg-zinc-50 text-xs font-medium text-zinc-600">
                  <ImageIcon className="size-3.5" /> Upload File
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-3 border-t border-zinc-100">
              <Button type="button" variant="outline" size="sm" onClick={() => { stopCamera(); setStep(2) }} className="flex items-center gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button type="button" size="sm" onClick={() => setStep(4)} className="bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-1">
                Review <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 4: Review & Confirm ─── */}
      {mode === "WIZARD" && step === 4 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Review Registration</CardTitle>
            <CardDescription className="text-xs">Confirm all details are correct before submitting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary Card */}
            <div className="border border-zinc-200/80 rounded-lg p-5 bg-zinc-50/50 flex flex-col items-center gap-4">
              <Avatar className="size-20 rounded-full border-2 border-zinc-200 bg-white shadow-sm">
                <AvatarImage src={photo || ""} className="object-cover" />
                <AvatarFallback className="text-xl font-bold bg-zinc-100 text-zinc-600">
                  {firstName?.[0]}{lastName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="text-center space-y-0.5">
                <h3 className="font-bold text-base text-zinc-900">{firstName} {lastName}</h3>
                <p className="text-xs font-mono text-zinc-500">{idNumber}</p>
                <Badge variant="outline" className="capitalize text-[10px] mt-1">{role}</Badge>
              </div>
            </div>

            {/* Detail rows */}
            <div className="text-xs space-y-2 divide-y divide-zinc-100">
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">RFID UID</span>
                <span className="font-mono font-semibold text-zinc-700">{rfidUid}</span>
              </div>
              {email && (
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Email</span>
                  <span className="text-zinc-700">{email}</span>
                </div>
              )}
              {department && (
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Department</span>
                  <span className="text-zinc-700">{department}</span>
                </div>
              )}
              {role === "student" && course && (
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Course</span>
                  <span className="text-zinc-700">{course}{yearLevel ? ` — Year ${yearLevel}` : ""}</span>
                </div>
              )}
              {role !== "student" && position && (
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Position</span>
                  <span className="text-zinc-700">{position}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Photo</span>
                <span className="text-zinc-700">{photo ? "✓ Captured" : "Not set"}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-3 border-t border-zinc-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(3)} className="flex items-center gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRegister}
                disabled={loading}
                className="bg-zinc-900 text-white hover:bg-zinc-800 min-w-[130px]"
              >
                {loading ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Saving...</> : "Complete Registration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── VERIFIED (card already linked) ─── */}
      {mode === "VERIFIED" && searchedProfile && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto overflow-hidden">
          <div className="h-1.5 bg-emerald-600 w-full" />
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="mx-auto size-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <UserCheck className="size-5 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-emerald-800">Already Registered</h2>
              <p className="text-xs text-zinc-400">This card is already linked to a clinic profile</p>
            </div>

            <div className="flex items-center gap-4 border border-zinc-200/80 rounded-lg p-4 bg-zinc-50/50 text-left">
              <Avatar className="size-16 rounded-full border border-zinc-200 bg-white shrink-0">
                <AvatarImage src={searchedProfile.clinic_photo_url || ""} className="object-cover" />
                <AvatarFallback className="text-lg font-bold bg-zinc-100 text-zinc-600">
                  {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-0.5">
                <h3 className="font-semibold text-sm text-zinc-900 truncate">{searchedProfile.first_name} {searchedProfile.last_name}</h3>
                <p className="text-xs font-mono text-zinc-500">{searchedProfile.student_number || searchedProfile.employee_number || "N/A"}</p>
                <p className="text-xs text-zinc-400 truncate">{searchedProfile.department || "N/A"}</p>
              </div>
            </div>

            <Button variant="outline" className="w-full h-9 text-xs" onClick={resetScanner}>
              Done (Esc)
            </Button>
            {resetTimer !== null && (
              <p className="text-[10px] text-zinc-400 animate-pulse">Auto-resetting in {resetTimer}s</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── SUCCESS ─── */}
      {mode === "SUCCESS" && searchedProfile && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto overflow-hidden">
          <div className="h-1.5 bg-emerald-600 w-full" />
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto border border-emerald-200/60">
              <Check className="size-7 text-emerald-600" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-900">RFID Linked Successfully</h2>
              <p className="text-xs text-zinc-400">Card is now associated with this clinic profile</p>
            </div>

            <div className="flex items-center gap-4 border border-zinc-200/80 rounded-lg p-4 bg-zinc-50/50 text-left">
              <Avatar className="size-14 rounded-full border border-zinc-200 bg-white shrink-0">
                <AvatarImage src={searchedProfile.clinic_photo_url || ""} className="object-cover" />
                <AvatarFallback className="font-bold bg-zinc-100 text-zinc-600">
                  {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 text-xs space-y-0.5">
                <div className="font-semibold text-sm text-zinc-900">{searchedProfile.first_name} {searchedProfile.last_name}</div>
                <div className="font-mono text-zinc-500">{searchedProfile.student_number || searchedProfile.employee_number}</div>
                <div className="font-mono text-zinc-400">{searchedProfile.rfid_uid}</div>
              </div>
            </div>

            <Button className="w-full h-9 text-xs bg-zinc-900 text-white hover:bg-zinc-800" onClick={resetScanner}>
              Register Another (Esc)
            </Button>
            {resetTimer !== null && (
              <p className="text-[10px] text-zinc-400 animate-pulse">Auto-resetting in {resetTimer}s</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
