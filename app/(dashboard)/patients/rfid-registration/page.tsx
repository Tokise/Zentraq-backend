"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Image as ImageIcon,
  Pencil
} from "lucide-react"

type PageMode = "WIZARD" | "VERIFIED" | "EDIT" | "SUCCESS"

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
const STUDENT_ID_PREFIX = "23011"

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
  const [studentIdSuffix, setStudentIdSuffix] = useState("")
  const [generatingId, setGeneratingId] = useState(false)
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

  // Cleanup camera when leaving step 3 or the Edit screen
  useEffect(() => {
    const cameraAllowed = (mode === "WIZARD" && step === 3) || mode === "EDIT"
    if (!cameraAllowed) {
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

  // Keep idNumber in sync with the formatted student ID whenever the suffix changes
  useEffect(() => {
    if (role === "student") {
      setIdNumber(`${STUDENT_ID_PREFIX}${studentIdSuffix}`)
    }
  }, [studentIdSuffix, role])

  // Auto-suggest (auto-generate) a student ID only for brand-new registrations —
  // i.e. Step 2 of the wizard, never in Edit mode, and never overwrite an
  // existing value the user already has in the field.
  useEffect(() => {
    const shouldSuggest =
      mode === "WIZARD" && step === 2 && role === "student" && !studentIdSuffix

    if (shouldSuggest) {
      generateStudentId()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step, role])

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
    setStudentIdSuffix("")
  }

  function handleRoleChange(newRole: "student" | "faculty" | "staff") {
    setRole(newRole)
    setCourse(""); setYearLevel(""); setPosition("")
    if (newRole !== "student") {
      setIdNumber("")
      setStudentIdSuffix("")
    } else {
      setIdNumber(`${STUDENT_ID_PREFIX}${studentIdSuffix}`)
    }
  }

  // Generate the NEXT sequential, guaranteed-unique 4-digit student ID suffix.
  async function generateStudentId() {
    setGeneratingId(true)
    try {
      const { data: lastRecords, error: lastError } = await supabase
        .from("clinic_profiles")
        .select("student_number")
        .not("student_number", "is", null)
        .like("student_number", `${STUDENT_ID_PREFIX}%`)
        .order("student_number", { ascending: false })
        .limit(1)

      if (lastError) throw lastError

      let nextNumber = 1
      if (lastRecords && lastRecords.length > 0) {
        const lastSuffix = parseStudentIdSuffix(lastRecords[0].student_number)
        const lastNum = parseInt(lastSuffix, 10)
        if (!isNaN(lastNum)) nextNumber = lastNum + 1
      }

      let suffix = String(nextNumber).padStart(4, "0")
      let attempts = 0
      while (attempts < 50) {
        const candidate = `${STUDENT_ID_PREFIX}${suffix}`
        const { data: existing, error: checkError } = await supabase
          .from("clinic_profiles")
          .select("id")
          .eq("student_number", candidate)
          .maybeSingle()
        if (checkError) throw checkError
        if (!existing) break
        nextNumber++
        suffix = String(nextNumber).padStart(4, "0")
        attempts++
      }

      if (nextNumber > 9999) {
        toast.error("All student IDs in the 23011-0001 to 23011-9999 range are taken.")
        return
      }

      setStudentIdSuffix(suffix)
    } catch (err: any) {
      toast.error(err.message || "Failed to generate student ID")
    } finally {
      setGeneratingId(false)
    }
  }

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

  function parseStudentIdSuffix(value: string | null): string {
    if (!value) return ""
    if (value.startsWith(STUDENT_ID_PREFIX)) return value.slice(STUDENT_ID_PREFIX.length)
    const match = value.match(/(\d{4})$/)
    return match ? match[1] : ""
  }

  function openEditMode(data: PatientProfile) {
    setSearchedProfile(data)
    setRfidUid(data.rfid_uid)

    const initialRole: "student" | "faculty" | "staff" = data.student_number ? "student" : "staff"
    setRole(initialRole)
    setFirstName(data.first_name || "")
    setLastName(data.last_name || "")
    setEmail(data.email || "")
    setDepartment(data.department || "")
    setCourse(data.course || "")
    setYearLevel(data.year_level || "")
    setPosition(data.position || "")
    setPhoto(data.clinic_photo_url || null)

    if (initialRole === "student") {
      const suffix = parseStudentIdSuffix(data.student_number)
      setStudentIdSuffix(suffix)
      setIdNumber(suffix ? `${STUDENT_ID_PREFIX}${suffix}` : (data.student_number || ""))
    } else {
      setStudentIdSuffix("")
      setIdNumber(data.employee_number || "")
    }

    setResetTimer(null)
    setMode("EDIT")
  }

  function handleInfoNext(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName || !idNumber) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (role === "student" && studentIdSuffix.length !== 4) {
      toast.error("Student ID must have 4 digits.")
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

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!searchedProfile) return
    if (!firstName || !lastName || !idNumber) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (role === "student" && studentIdSuffix.length !== 4) {
      toast.error("Student ID must have 4 digits.")
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

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .update({
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
        })
        .eq("id", searchedProfile.id)
        .select()
        .single()

      if (error) throw error
      toast.success("Profile updated!")
      setSearchedProfile(data as PatientProfile)
      setMode("SUCCESS")
      setResetTimer(8)
    } catch (err: any) {
      toast.error(err.message || "Update failed")
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
                  onChange={(e) => handleRoleChange(e.target.value as any)}
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
                {role === "student" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Student No. <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1.5">
                      <div className="h-9 px-2.5 flex items-center rounded-md border border-zinc-200 bg-zinc-50 text-sm font-mono text-zinc-500 select-none shrink-0">
                        {STUDENT_ID_PREFIX}
                      </div>
                      <Input
                        value={studentIdSuffix}
                        onChange={(e) => setStudentIdSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="0000"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        disabled={generatingId}
                        className="h-9 font-mono tracking-widest"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateStudentId}
                        disabled={generatingId}
                        className="h-9 px-2 shrink-0"
                        title="Generate a new ID"
                      >
                        <RefreshCw className={`size-3.5 ${generatingId ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-[10px] text-zinc-400">Next available ID — edit manually if needed</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee No. <span className="text-red-500">*</span></Label>
                    <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="EMP-0231" required className="h-9" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@school.edu" className="h-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                  <option value="">Select Department</option>
                  <option value="College of Engineering">College of Engineering</option>
                  <option value="College of Computer Studies">College of Computer Studies</option>
                  <option value="College of Nursing">College of Nursing</option>
                  <option value="College of Arts and Sciences">College of Arts and Sciences</option>
                  <option value="College of Business">College of Business</option>
                </select>
              </div>

              {role === "student" && (
                <div className="grid gap-3 grid-cols-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Course <span className="text-red-500">*</span></Label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      required
                    >
                      <option value="">Select Course</option>
                      <option value="BS Information Technology">BS Information Technology</option>
                      <option value="BS Computer Science">BS Computer Science</option>
                      <option value="BS Nursing">BS Nursing</option>
                      <option value="BS Psychology">BS Psychology</option>
                      <option value="BS Business Administration">BS Business Administration</option>
                    </select>
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

      {mode === "WIZARD" && step === 3 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Profile Photo</CardTitle>
            <CardDescription className="text-xs">Capture or upload a photo for {firstName} {lastName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative size-48 rounded-2xl overflow-hidden border-2 border-zinc-200 bg-zinc-50 flex items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="size-full object-cover scale-x-[-1]" />
                ) : photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : (
                  <CameraOff className="size-10 text-zinc-300" />
                )}
                {cameraActive && !photo && (
                  <div className="absolute inset-5 rounded-xl border border-dashed border-white/60 pointer-events-none" />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" width="200" height="200" />

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
                {photo && !cameraActive && (
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

      {mode === "WIZARD" && step === 4 && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Review Registration</CardTitle>
            <CardDescription className="text-xs">Confirm all details are correct before submitting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="border border-zinc-200/80 rounded-lg p-5 bg-zinc-50/50 flex flex-col items-center gap-4">
              <div className="size-20 rounded-2xl overflow-hidden border-2 border-zinc-200 bg-white shadow-sm flex items-center justify-center shrink-0">
                {photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : (
                  <span className="text-xl font-bold bg-zinc-100 text-zinc-600 size-full flex items-center justify-center">
                    {firstName?.[0]}{lastName?.[0]}
                  </span>
                )}
              </div>

              <div className="text-center space-y-0.5">
                <h3 className="font-bold text-base text-zinc-900">{firstName} {lastName}</h3>
                <p className="text-xs font-mono text-zinc-500">{idNumber}</p>
                <Badge variant="outline" className="capitalize text-[10px] mt-1">{role}</Badge>
              </div>
            </div>

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

      {mode === "VERIFIED" && searchedProfile && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto overflow-hidden">
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="mx-auto size-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <UserCheck className="size-5 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-emerald-800">Already Registered</h2>
              <p className="text-xs text-zinc-400">This card is already linked to a clinic profile</p>
            </div>

            <div className="flex items-center gap-4 border border-zinc-200/80 rounded-lg p-4 bg-zinc-50/50 text-left">
              <div className="size-16 rounded-2xl overflow-hidden border border-zinc-200 bg-white shrink-0 flex items-center justify-center">
                {searchedProfile.clinic_photo_url ? (
                  <img src={searchedProfile.clinic_photo_url} alt="Profile" className="size-full object-cover" />
                ) : (
                  <span className="text-lg font-bold bg-zinc-100 text-zinc-600 size-full flex items-center justify-center">
                    {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="font-semibold text-sm text-zinc-900 truncate">{searchedProfile.first_name} {searchedProfile.last_name}</h3>
                <p className="text-xs font-mono text-zinc-500">{searchedProfile.student_number || searchedProfile.employee_number || "N/A"}</p>
                <p className="text-xs text-zinc-400 truncate">{searchedProfile.department || "N/A"}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs flex items-center justify-center gap-1.5" onClick={() => openEditMode(searchedProfile)}>
                <Pencil className="size-3.5" /> Edit Info
              </Button>
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={resetScanner}>
                Done (Esc)
              </Button>
            </div>
            {resetTimer !== null && (
              <p className="text-[10px] text-zinc-400 animate-pulse">Auto-resetting in {resetTimer}s</p>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "EDIT" && searchedProfile && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Edit Profile</CardTitle>
            <CardDescription className="text-xs">
              Card: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-700 font-semibold">{rfidUid}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-28 rounded-2xl overflow-hidden border-2 border-zinc-200 bg-zinc-50 flex items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="size-full object-cover scale-x-[-1]" />
                ) : photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : (
                  <CameraOff className="size-8 text-zinc-300" />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" width="200" height="200" />

              <div className="flex flex-wrap justify-center gap-2">
                {!cameraActive && (
                  <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                    <Camera className="size-3.5 mr-1" /> {photo ? "Retake Photo" : "Take Photo"}
                  </Button>
                )}
                {cameraActive && (
                  <>
                    <Button type="button" size="sm" onClick={capturePhoto} className="bg-zinc-900 text-white hover:bg-zinc-800">
                      <Check className="size-3.5 mr-1" /> Capture
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={stopCamera} className="text-red-500 hover:bg-red-50">
                      Cancel
                    </Button>
                  </>
                )}
                <input type="file" accept="image/*" id="edit-photo-upload" onChange={handlePhotoUpload} className="hidden" />
                <label htmlFor="edit-photo-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-200 cursor-pointer hover:bg-zinc-50 text-xs font-medium text-zinc-600">
                  <ImageIcon className="size-3.5" /> Upload
                </label>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as any)}
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
                {role === "student" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Student No. <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1.5">
                      <div className="h-9 px-2.5 flex items-center rounded-md border border-zinc-200 bg-zinc-50 text-sm font-mono text-zinc-500 select-none shrink-0">
                        {STUDENT_ID_PREFIX}
                      </div>
                      <Input
                        value={studentIdSuffix}
                        onChange={(e) => setStudentIdSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="0000"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        className="h-9 font-mono tracking-widest"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee No. <span className="text-red-500">*</span></Label>
                    <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="EMP-0231" required className="h-9" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@school.edu" className="h-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                  <option value="">Select Department</option>
                  <option value="College of Engineering">College of Engineering</option>
                  <option value="College of Computer Studies">College of Computer Studies</option>
                  <option value="College of Nursing">College of Nursing</option>
                  <option value="College of Arts and Sciences">College of Arts and Sciences</option>
                  <option value="College of Business">College of Business</option>
                </select>
              </div>

              {role === "student" && (
                <div className="grid gap-3 grid-cols-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Course <span className="text-red-500">*</span></Label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      required
                    >
                      <option value="">Select Course</option>
                      <option value="BS Information Technology">BS Information Technology</option>
                      <option value="BS Computer Science">BS Computer Science</option>
                      <option value="BS Nursing">BS Nursing</option>
                      <option value="BS Psychology">BS Psychology</option>
                      <option value="BS Business Administration">BS Business Administration</option>
                    </select>
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
                <Button type="submit" size="sm" disabled={loading} className="bg-zinc-900 text-white hover:bg-zinc-800 min-w-[120px] flex items-center gap-1">
                  {loading ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Saving...</> : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "SUCCESS" && searchedProfile && (
        <Card className="border-zinc-200/80 shadow-sm bg-white max-w-md mx-auto overflow-hidden">
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto border border-emerald-200/60">
              <Check className="size-7 text-emerald-600" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-900">RFID Linked Successfully</h2>
              <p className="text-xs text-zinc-400">Card is now associated with this clinic profile</p>
            </div>

            <div className="flex items-center gap-4 border border-zinc-200/80 rounded-lg p-4 bg-zinc-50/50 text-left">
              <div className="size-14 rounded-2xl overflow-hidden border border-zinc-200 bg-white shrink-0 flex items-center justify-center">
                {searchedProfile.clinic_photo_url ? (
                  <img src={searchedProfile.clinic_photo_url} alt="Profile" className="size-full object-cover" />
                ) : (
                  <span className="font-bold bg-zinc-100 text-zinc-600 size-full flex items-center justify-center">
                    {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                  </span>
                )}
              </div>
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