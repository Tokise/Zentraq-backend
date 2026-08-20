"use client"

import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
} from "react"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  createStudentAccountAction,
  generateStudentIdAction,
  lookupStudentByRfidAction,
  registerStudentProfileAction,
  updateStudentProfileAction,
} from "@/actions/rfid/registration"
import { resetPortalPasswordAction } from "@/actions/accounts/patient-portal"
import { PasswordStrengthInput } from "@/components/common/password-strength-input"
import { checkPassword } from "@/lib/validation/password"
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
  Pencil,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react"

type PageMode = "WIZARD" | "VERIFIED" | "EDIT" | "SUCCESS"

interface PatientProfile {
  id: string
  role: "student" | "faculty" | "staff"
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
  user_id?: string | null
}

const STEPS = ["Scan Card", "Student Info", "Profile Photo", "Review", "Account Setup"]
const STUDENT_ID_PREFIX = "23011"
const ACADEMIC_DEPARTMENTS = [
  "College of Engineering",
  "College of Computer Studies",
  "College of Nursing",
  "College of Arts and Sciences",
  "College of Business",
] as const
const STAFF_DEPARTMENTS = [
  "Clinic",
  "Registrar",
  "IT",
  "Maintenance",
  "Guidance",
] as const
const CLINIC_POSITIONS = ["Doctor", "Nurse", "Admin"] as const

interface EmploymentFieldsProps {
  department: string
  onDepartmentChange: (value: string) => void
  onPositionChange: (value: string) => void
  position: string
  role: PatientProfile["role"]
}

// Renders role-specific department and position controls for profile registration.
function EmploymentFields({
  department,
  onDepartmentChange,
  onPositionChange,
  position,
  role,
}: EmploymentFieldsProps) {
  const departments = role === "staff" ? STAFF_DEPARTMENTS : ACADEMIC_DEPARTMENTS
  const clinicStaff = role === "staff" && department === "Clinic"

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Department</Label>
        <Select
          onValueChange={(value) => onDepartmentChange(value ?? "")}
          value={department || null}
        >
          <SelectTrigger className="w-full rounded-md border-border bg-background">
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {role !== "student" && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Position <span className="text-red-500">*</span>
          </Label>
          {clinicStaff ? (
            <Select
              onValueChange={(value) => onPositionChange(value ?? "")}
              value={position || null}
            >
              <SelectTrigger className="w-full rounded-md border-border bg-background">
                <SelectValue placeholder="Select Clinic position" />
              </SelectTrigger>
              <SelectContent>
                {CLINIC_POSITIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-9 bg-background"
              onChange={(event) => onPositionChange(event.target.value)}
              placeholder={role === "faculty" ? "Professor" : "Lab Technician"}
              required
              value={position}
            />
          )}
        </div>
      )}
    </>
  )
}

export default function RfidRegistrationPage() {
  const [mode, setMode] = useState<PageMode>("WIZARD")
  const [step, setStep] = useState(1)
  const [rfidUid, setRfidUid] = useState("")
  const [searchedProfile, setSearchedProfile] = useState<PatientProfile | null>(null)
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null)

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

  // Account creation
  const [accountEmail, setAccountEmail] = useState("")
  const [accountPassword, setAccountPassword] = useState("")
  const [accountCreated, setAccountCreated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [skippedAccount, setSkippedAccount] = useState(false)
  const [editAccountCreated, setEditAccountCreated] = useState(false)

  // Reset password (for profiles that already have a linked account)
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetPassword, setResetPassword] = useState("")
  const [resettingPassword, setResettingPassword] = useState(false)

  // UI
  const [loading, setLoading] = useState(false)
  const [resetTimer, setResetTimer] = useState<number | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Refs
  const rfidInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

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

  // Attaches a newly acquired stream only after the video element is mounted.
  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    void video.play().catch(() => {
      toast.error("Camera preview could not start. Use the file upload option.")
      stopCamera()
    })
  }, [cameraActive])

  // Releases the camera if the registration page is closed or navigated away from.
  useEffect(() => () => stopCamera(), [])

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

  // Auto-suggest (auto-generate) a student ID only for brand-new registrations
  useEffect(() => {
    const shouldSuggest =
      mode === "WIZARD" && step === 2 && role === "student" && !studentIdSuffix

    if (shouldSuggest) {
      handleGenerateStudentId()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step, role])

  function resetScanner() {
    setMode("WIZARD")
    setStep(1)
    setRfidUid("")
    setSearchedProfile(null)
    setCreatedProfileId(null)
    setResetTimer(null)
    setFirstName(""); setLastName(""); setIdNumber(""); setEmail("")
    setDepartment(""); setCourse(""); setYearLevel(""); setPosition("")
    setPhoto(null)
    setRole("student")
    setStudentIdSuffix("")
    setAccountEmail(""); setAccountPassword(""); setAccountCreated(false)
    setSkippedAccount(false); setCreatingAccount(false)
    setEditAccountCreated(false)
  }

  function handleRoleChange(newRole: "student" | "faculty" | "staff") {
    setRole(newRole)
    setCourse(""); setYearLevel(""); setDepartment(""); setPosition("")
    if (newRole !== "student") {
      setIdNumber("")
      setStudentIdSuffix("")
    } else {
      setIdNumber(`${STUDENT_ID_PREFIX}${studentIdSuffix}`)
    }
  }

  // Keeps the formatted Student ID and editable suffix synchronized.
  function handleStudentIdSuffixChange(value: string) {
    const suffix = value.replace(/\D/g, "").slice(0, 4)
    setStudentIdSuffix(suffix)
    setIdNumber(`${STUDENT_ID_PREFIX}${suffix}`)
  }

  // Updates the profile email and pre-fills an untouched portal email.
  function handleEmailChange(value: string) {
    setEmail(value)
    if (!accountEmail) setAccountEmail(value)
  }

  // Generate the NEXT sequential, guaranteed-unique 4-digit student ID suffix.
  async function handleGenerateStudentId() {
    setGeneratingId(true)
    try {
      const result = await generateStudentIdAction()
      if ("error" in result && result.error) {
        toast.error(result.error)
      } else {
        handleStudentIdSuffixChange(result.suffix || "")
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to generate student ID"))
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
      const formData = new FormData()
      formData.set("rfidUid", uid)
      const result = await lookupStudentByRfidAction(formData)

      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        setSearchedProfile(result.data as PatientProfile)
        setMode("VERIFIED")
        setResetTimer(8)
        toast.success(`Profile already registered for ${result.data.first_name}`)
      } else {
        setStep(2)
        toast.info("Card not registered. Fill in student details to continue.")
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Lookup failed"))
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

    const initialRole = data.role
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
    setAccountEmail(data.email || "")
    setAccountPassword("")
    setAccountCreated(false)
    setEditAccountCreated(!!data.user_id)
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
  }

  // Clears a stale position whenever Staff switches department classifications.
  function handleDepartmentChange(value: string) {
    if (role === "staff" && value !== department) setPosition("")
    setDepartment(value)
  }

  async function startCamera() {
    if (!window.isSecureContext) {
      toast.error("Camera access requires HTTPS or localhost. Use the file upload option.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support camera capture. Use the file upload option.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 400 },
          height: { ideal: 400 },
          facingMode: { ideal: "user" },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch (error) {
      setCameraActive(false)
      const name = error instanceof DOMException ? error.name : ""
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("Camera permission was denied. Allow access or use the file upload option.")
      } else if (name === "NotFoundError") {
        toast.error("No camera was found. Use the file upload option.")
      } else {
        toast.error("Unable to start the camera. Use the file upload option.")
      }
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

  // Step 4 → Create the student or faculty profile via Server Action, then go to Account Setup.
  async function handleRegister() {
    if (!rfidUid) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.set("rfidUid", rfidUid)
      formData.set("firstName", firstName)
      formData.set("lastName", lastName)
      formData.set("email", email || "")
      formData.set("department", department || "")
      formData.set("course", role === "student" ? course : "")
      formData.set("yearLevel", role === "student" ? yearLevel : "")
      formData.set("position", role !== "student" ? position : "")
      formData.set("studentNumber", role === "student" ? idNumber : "")
      formData.set("employeeNumber", role !== "student" ? idNumber : "")
      formData.set("clinicPhotoUrl", photo || "")
      formData.set("role", role)

      const result = await registerStudentProfileAction(formData)

      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        setCreatedProfileId(result.data.id)
        setSearchedProfile(result.data as PatientProfile)

        // Pre-fill account email
        if (result.data.email && !accountEmail) {
          setAccountEmail(result.data.email)
        }

        toast.success("Profile registered! Now set up their portal account.")
        setStep(5) // Go to Account Setup step
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Registration failed"))
    } finally {
      setLoading(false)
    }
  }

  // Step 5 → Create an auth user and link it to the new patient profile.
  async function handleCreateAccount() {
    if (!accountEmail || !accountPassword) {
      toast.error("Please enter an email and password.")
      return
    }
    const accountPasswordCheck = checkPassword(accountPassword)
    if (!accountPasswordCheck.valid) {
      toast.error(`Password needs: ${accountPasswordCheck.missing.join(", ")}`)
      return
    }
    if (!createdProfileId) return

    setCreatingAccount(true)
    try {
      const formData = new FormData()
      formData.set("email", accountEmail)
      formData.set("password", accountPassword)
      formData.set("studentAccountId", createdProfileId)

      const result = await createStudentAccountAction(formData)

      if ("error" in result && result.error) {
        toast.error(result.error)
      } else if (!("error" in result)) {
        setAccountCreated(true)
        if (searchedProfile && result.userId) {
          setSearchedProfile({ ...searchedProfile, user_id: result.userId })
        }
        toast.success("Portal account created! The student can now log in.")
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create account"))
    } finally {
      setCreatingAccount(false)
    }
  }

  async function handleSkipAccount() {
    setSkippedAccount(true)
    setMode("SUCCESS")
    setResetTimer(8)
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
      const formData = new FormData()
      formData.set("profileId", searchedProfile.id)
      formData.set("firstName", firstName)
      formData.set("lastName", lastName)
      formData.set("email", email || "")
      formData.set("department", department || "")
      formData.set("course", role === "student" ? course : "")
      formData.set("yearLevel", role === "student" ? yearLevel : "")
      formData.set("position", role !== "student" ? position : "")
      formData.set("studentNumber", role === "student" ? idNumber : "")
      formData.set("employeeNumber", role !== "student" ? idNumber : "")
      formData.set("clinicPhotoUrl", photo || "")
      formData.set("role", role)

      const result = await updateStudentProfileAction(formData)

      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        const updatedProfile = result.data as PatientProfile
        toast.success("Profile and photo saved!")
        setSearchedProfile(updatedProfile)
        setPhoto(updatedProfile.clinic_photo_url)
        setAccountEmail(updatedProfile.email || "")
        setStep(2)
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Update failed"))
    } finally {
      setLoading(false)
    }
  }

  // EDIT mode account creation via server action
  async function handleCreateEditAccount() {
    if (!accountEmail || !accountPassword) {
      toast.error("Please enter an email and password.")
      return
    }
    const editPasswordCheck = checkPassword(accountPassword)
    if (!editPasswordCheck.valid) {
      toast.error(`Password needs: ${editPasswordCheck.missing.join(", ")}`)
      return
    }
    if (!searchedProfile?.id) return

    setCreatingAccount(true)
    try {
      const formData = new FormData()
      formData.set("email", accountEmail)
      formData.set("password", accountPassword)
      formData.set("studentAccountId", searchedProfile.id)

      const result = await createStudentAccountAction(formData)

      if ("error" in result && result.error) {
        toast.error(result.error)
      } else if (!("error" in result)) {
        setEditAccountCreated(true)
        toast.success("Portal account created!")
        if (searchedProfile) {
          setSearchedProfile({ ...searchedProfile, user_id: result.userId || result.email })
        }
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create account"))
    } finally {
      setCreatingAccount(false)
    }
  }

  // Reset password for a profile that already has a linked portal account
  async function handleResetPassword() {
    if (!resetPassword) {
      toast.error("Please enter a new password.")
      return
    }
    const resetPasswordCheck = checkPassword(resetPassword)
    if (!resetPasswordCheck.valid) {
      toast.error(`Password needs: ${resetPasswordCheck.missing.join(", ")}`)
      return
    }
    if (!searchedProfile?.id) return

    setResettingPassword(true)
    try {
      const result = await resetPortalPasswordAction({
        newPassword: resetPassword,
        role: searchedProfile.role,
        targetId: searchedProfile.id,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Password reset successfully!")
        setAccountPassword(resetPassword)
        setShowPassword(true)
        setShowResetForm(false)
        setResetPassword("")
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to reset password"))
    } finally {
      setResettingPassword(false)
    }
  }

  function finishWizard() {
    setMode("SUCCESS")
    setResetTimer(8)
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
            const connectorDone = step > i
            const circleStyle: CSSProperties = isDone
              ? {
                  backgroundColor: "var(--primary, #1f7a58)",
                  borderColor: "var(--primary, #1f7a58)",
                  color: "var(--primary-foreground, #ffffff)",
                }
              : isActive
                ? {
                    backgroundColor: "var(--primary, #1f7a58)",
                    borderColor: "var(--primary, #1f7a58)",
                    boxShadow: "0 0 0 4px rgb(31 122 88 / 18%)",
                    color: "var(--primary-foreground, #ffffff)",
                  }
                : {
                    backgroundColor: "var(--muted, #e2e9e3)",
                    borderColor: "var(--border, #d1ddd4)",
                    color: "var(--muted-foreground, #526058)",
                  }
            const labelStyle: CSSProperties = {
              color: isDone
                ? "var(--primary, #1f7a58)"
                : isActive
                  ? "var(--primary, #1f7a58)"
                  : "var(--muted-foreground, #526058)",
            }
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <div
                    aria-hidden
                    className="mx-1 h-0.5 w-8 rounded-full transition-colors"
                    style={{
                      backgroundColor: connectorDone
                        ? "var(--primary, #1f7a58)"
                        : "var(--border, #d1ddd4)",
                    }}
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    aria-current={isActive ? "step" : undefined}
                    className="flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-all"
                    style={circleStyle}
                  >
                    {isDone ? <Check className="size-3.5" /> : stepNum}
                  </div>
                  <span
                    className={`text-[10px] transition-colors ${
                      isActive || isDone ? "font-semibold" : ""
                    }`}
                    style={labelStyle}
                  >
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === "WIZARD" && step === 1 && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-foreground">Scan or Enter RFID</h2>
              <p className="text-xs text-muted-foreground">Tap the card on the desk reader or type the UID manually</p>
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
                className="h-10 w-full"
              >
                {loading ? <RefreshCw className="size-4 animate-spin mr-1.5" /> : null}
                {loading ? "Searching..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "WIZARD" && step === 2 && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Student Details</CardTitle>
            <CardDescription className="text-xs">
              Card: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-semibold">{rfidUid}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInfoNext} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <select
                  value={role}
                  onChange={(e) =>
                    handleRoleChange(
                      e.target.value as "student" | "faculty" | "staff",
                    )
                  }
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div className="grid gap-3 grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">First Name <span className="text-red-500">*</span></Label>
                        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-9 bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Last Name <span className="text-red-500">*</span></Label>
                        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-9 bg-background" />
                      </div>
              </div>

              <div className="grid gap-3 grid-cols-2">
                {role === "student" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Student No. <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1.5">
                      <div className="h-9 px-2.5 flex items-center rounded-md border border-border bg-muted text-sm font-mono text-muted-foreground select-none shrink-0">
                        {STUDENT_ID_PREFIX}
                      </div>
                      <Input
                        value={studentIdSuffix}
                        onChange={(e) =>
                          handleStudentIdSuffixChange(e.target.value)
                        }
                        placeholder="0000"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        disabled={generatingId}
                        className="h-9 font-mono tracking-widest bg-background"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateStudentId}
                        disabled={generatingId}
                        className="h-9 shrink-0 px-2"
                        title="Generate a new ID"
                      >
                        <RefreshCw className={`size-3.5 ${generatingId ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Next available ID — edit manually if needed</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee No. <span className="text-red-500">*</span></Label>
                    <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="EMP-0231" required className="h-9 bg-background" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => handleEmailChange(e.target.value)} placeholder="mail@school.edu" className="h-9 bg-background" />
                </div>
              </div>

              <EmploymentFields
                department={department}
                onDepartmentChange={handleDepartmentChange}
                onPositionChange={setPosition}
                position={position}
                role={role}
              />

              {role === "student" && (
                <div className="grid gap-3 grid-cols-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Course <span className="text-red-500">*</span></Label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm focus:outline-none">
                      <option value="">—</option>
                      <option value="1">1st</option>
                      <option value="2">2nd</option>
                      <option value="3">3rd</option>
                      <option value="4">4th</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={resetScanner} className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex items-center gap-1">
                  Next <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "WIZARD" && step === 3 && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Profile Photo</CardTitle>
            <CardDescription className="text-xs">Capture or upload a photo for {firstName} {lastName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative size-48 rounded-2xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="size-full object-cover scale-x-[-1]" />
                ) : photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : (
                  <CameraOff className="size-10 text-muted-foreground" />
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
                  <Button type="button" size="sm" onClick={capturePhoto}>
                    <Check className="size-3.5 mr-1" /> Capture
                  </Button>
                )}
                {photo && !cameraActive && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPhoto(null); startCamera() }}>
                    <RotateCcw className="size-3.5 mr-1" /> Retake
                  </Button>
                )}
                {cameraActive && (
                  <Button type="button" variant="ghost" size="sm" onClick={stopCamera} className="text-red-500 cursor-pointer hover:bg-red-50">
                    Cancel
                  </Button>
                )}
              </div>

              <div className="text-center">
                <input type="file" accept="image/*" id="photo-upload" onChange={handlePhotoUpload} className="hidden" />
                <label htmlFor="photo-upload" className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary/35 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                  <ImageIcon className="size-3.5" /> Upload File
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => { stopCamera(); setStep(2) }} className="flex items-center gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button type="button" size="sm" onClick={() => setStep(4)} className="flex items-center gap-1">
                Review <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "WIZARD" && step === 4 && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Review Registration</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Confirm all details are correct before submitting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="border border-border rounded-lg p-5 bg-muted/50 flex flex-col items-center gap-4">
              <div className="size-20 rounded-2xl overflow-hidden border-2 border-border bg-card shadow-sm flex items-center justify-center shrink-0">
                {photo ? (
                  <img src={photo} alt="Preview" className="size-full object-cover" />
                ) : (
                  <span className="text-xl font-bold bg-muted text-foreground size-full flex items-center justify-center">
                    {firstName?.[0]}{lastName?.[0]}
                  </span>
                )}
              </div>

              <div className="text-center space-y-0.5">
                <h3 className="font-bold text-base text-foreground">{firstName} {lastName}</h3>
                <p className="text-xs font-mono text-muted-foreground">{idNumber}</p>
                <Badge variant="outline" className="capitalize text-[10px] mt-1">{role}</Badge>
              </div>
            </div>

            <div className="text-xs space-y-2 divide-y divide-border">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">RFID UID</span>
                <span className="font-mono font-semibold text-foreground">{rfidUid}</span>
              </div>
              {email && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground">{email}</span>
                </div>
              )}
              {department && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Department</span>
                  <span className="text-foreground">{department}</span>
                </div>
              )}
              {role === "student" && course && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Course</span>
                  <span className="text-foreground">{course}{yearLevel ? ` — Year ${yearLevel}` : ""}</span>
                </div>
              )}
              {role !== "student" && position && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Position</span>
                  <span className="text-foreground">{position}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Photo</span>
                <span className="text-foreground">{photo ? "✓ Captured" : "Not set"}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(3)} className="flex items-center gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRegister}
                disabled={loading}
                className="min-w-[130px]"
              >
                {loading ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Saving...</> : "Register & Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "WIZARD" && step === 5 && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Account Setup</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Create a portal account so {firstName} {lastName} can log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {accountCreated ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="size-5 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Account Created!</h3>
                  <p className="text-xs text-muted-foreground">The student can now log in.</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-left space-y-1 text-xs border border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-mono text-foreground">{accountEmail}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Password</span>
                    <span className="font-mono text-foreground flex items-center gap-2">
                      {showPassword ? accountPassword : "••••••••"}
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="rounded-md p-1 text-primary transition-colors hover:bg-primary/10">
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(accountPassword); toast.success("Copied!") }} className="rounded-md p-1 text-primary transition-colors hover:bg-primary/10">
                        <Copy className="size-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
                <Button size="sm" onClick={finishWizard}>
                  Complete Registration
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-muted rounded-lg p-3 text-xs space-y-1 mb-2 border border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground">{firstName} {lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-foreground">{idNumber}</span>
                  </div>
                </div>

                <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Login Email</Label>
                        <Input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="student@school.edu" className="h-9 bg-background" required />
                      </div>
                  <PasswordStrengthInput
                    label="Temporary Password"
                    id="account-password"
                    value={accountPassword}
                    onChange={setAccountPassword}
                    placeholder="Create a temporary password"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <Button size="sm" onClick={handleCreateAccount} disabled={creatingAccount}>
                    {creatingAccount ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Creating Account...</> : <><UserCheck className="size-3.5 mr-1" /> Create Portal Account</>}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleSkipAccount} className="text-primary hover:bg-primary/10 hover:text-primary">
                    Skip — register card only
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "VERIFIED" && searchedProfile && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto overflow-hidden">
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="mx-auto size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="size-5 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Already Registered</h2>
              <p className="text-xs text-muted-foreground">This card is already linked to a clinic profile</p>
            </div>

            <div className="flex items-center gap-4 border border-border rounded-lg p-4 bg-muted/50 text-left">
              <div className="size-16 rounded-2xl overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                {searchedProfile.clinic_photo_url ? (
                  <img src={searchedProfile.clinic_photo_url} alt="Profile" className="size-full object-cover" />
                ) : (
                  <span className="text-lg font-bold bg-muted text-foreground size-full flex items-center justify-center">
                    {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="font-semibold text-sm text-foreground truncate">{searchedProfile.first_name} {searchedProfile.last_name}</h3>
                <p className="text-xs font-mono text-muted-foreground">{searchedProfile.student_number || searchedProfile.employee_number || "N/A"}</p>
                <p className="text-xs text-muted-foreground truncate">{searchedProfile.department || "N/A"}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => openEditMode(searchedProfile)}>
                <Pencil className="size-3.5" /> Edit Info
              </Button>
              <Button className="h-9 flex-1 text-xs" onClick={resetScanner}>
                Done (Esc)
              </Button>
            </div>
            {resetTimer !== null && (
              <p className="text-[10px] text-muted-foreground animate-pulse">Auto-resetting in {resetTimer}s</p>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "EDIT" && searchedProfile && (
        <>
          <div className="flex items-center justify-center gap-0 mb-4">
            {[1, 2].map((label, i) => {
              const stepNum = i + 1
              const isActive = step === stepNum
              const isDone = step > stepNum
              return (
                <div key={label} className="flex items-center">
                  {i > 0 && (
                    <div className={`mx-1 h-0.5 w-8 ${isDone ? "bg-primary" : "bg-border"}`} />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${isDone
                        ? "bg-primary text-primary-foreground"
                        : isActive
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                          : "border border-border bg-muted text-muted-foreground"
                        }`}
                    >
                      {isDone ? <Check className="size-3" /> : stepNum}
                    </div>
                    <span className={`text-[9px] ${isActive || isDone ? "font-medium text-primary" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <Card className="border-border shadow-sm bg-card max-w-md mx-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Edit Profile</CardTitle>
              <CardDescription className="text-xs">
                Card: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-semibold">{rfidUid}</code>
                {searchedProfile.user_id && <span className="ml-2 text-emerald-500">• Portal account linked</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* EDIT SUB-STEP 1: Profile edit */}
              {step === 1 && (
                <>
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative size-28 rounded-2xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shadow-inner">
                      {cameraActive ? (
                        <video ref={videoRef} autoPlay playsInline className="size-full object-cover scale-x-[-1]" />
                      ) : photo ? (
                        <img src={photo} alt="Preview" className="size-full object-cover" />
                      ) : (
                        <CameraOff className="size-8 text-muted-foreground" />
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" width="200" height="200" />

                    <div className="flex flex-wrap justify-center gap-2">
                      {!cameraActive && (
                        <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                          <Camera className="mr-1 size-3.5" /> {photo ? "Retake Photo" : "Take Photo"}
                        </Button>
                      )}
                      {cameraActive && (
                        <>
                          <Button type="button" size="sm" onClick={capturePhoto}>
                            <Check className="size-3.5 mr-1" /> Capture
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={stopCamera} className="text-red-500 cursor-pointer hover:bg-red-50">
                            Cancel
                          </Button>
                        </>
                      )}
                      <input type="file" accept="image/*" id="edit-photo-upload" onChange={handlePhotoUpload} className="hidden" />
                      <label htmlFor="edit-photo-upload" className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary/35 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                        <ImageIcon className="size-3.5" /> Upload
                      </label>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Role</Label>
                      <select
                        value={role}
                        onChange={(e) =>
                          handleRoleChange(
                            e.target.value as
                              | "student"
                              | "faculty"
                              | "staff",
                          )
                        }
                        className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="staff">Staff</option>
                      </select>
                    </div>

                    <div className="grid gap-3 grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">First Name <span className="text-red-500">*</span></Label>
                        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-9 bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Last Name <span className="text-red-500">*</span></Label>
                        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-9 bg-background" />
                      </div>
                    </div>

                    <div className="grid gap-3 grid-cols-2">
                      {role === "student" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student No. <span className="text-red-500">*</span></Label>
                      <div className="flex items-center gap-1.5">
                        <div className="h-9 px-2.5 flex items-center rounded-md border border-border bg-muted text-sm font-mono text-muted-foreground select-none shrink-0">
                          {STUDENT_ID_PREFIX}
                        </div>
                        <Input
                          value={studentIdSuffix}
                          onChange={(e) =>
                            handleStudentIdSuffixChange(e.target.value)
                          }
                          placeholder="0000"
                          inputMode="numeric"
                          maxLength={4}
                          required
                          className="h-9 font-mono tracking-widest bg-background"
                        />
                      </div>
                    </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Employee No. <span className="text-red-500">*</span></Label>
                          <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="EMP-0231" required className="h-9 bg-background" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={email} onChange={(e) => handleEmailChange(e.target.value)} placeholder="mail@school.edu" className="h-9 bg-background" />
                      </div>
                    </div>

                    <EmploymentFields
                      department={department}
                      onDepartmentChange={handleDepartmentChange}
                      onPositionChange={setPosition}
                      position={position}
                      role={role}
                    />

                    {role === "student" && (
                      <div className="grid gap-3 grid-cols-3">
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-xs">Course <span className="text-red-500">*</span></Label>
                          <select
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                            className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                          <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm focus:outline-none">
                            <option value="">—</option>
                            <option value="1">1st</option>
                            <option value="2">2nd</option>
                            <option value="3">3rd</option>
                            <option value="4">4th</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end pt-3 border-t border-border">
                      <Button type="button" variant="outline" size="sm" onClick={resetScanner} className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        Cancel
                      </Button>
                      <Button
                        disabled={loading}
                        size="sm"
                        type="submit"
                      >
                        {loading ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="size-3.5" />
                        )}
                        {loading ? "Saving..." : "Save & Continue"}
                      </Button>
                    </div>
                  </form>
                </>
              )}

              {/* EDIT SUB-STEP 2: Account creation */}
              {step === 2 && (
                <div className="space-y-5">
                  {editAccountCreated ? (
                    <div className="text-center space-y-3 py-4">
                      <div className="mx-auto size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Check className="size-5 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Account Already Linked</h3>
                      <p className="text-xs text-muted-foreground">This profile already has a portal account.</p>
                      <div className="bg-muted rounded-lg p-3 text-left space-y-1 text-xs border border-border">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-mono text-foreground">{accountEmail}</span>
                        </div>
                      </div>

                      {showResetForm ? (
                        <div className="space-y-3 text-left pt-1">
                          <PasswordStrengthInput
                            label="New Password"
                            id="reset-password"
                            value={resetPassword}
                            onChange={setResetPassword}
                            placeholder="Create a new password"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleResetPassword}
                              disabled={resettingPassword}
                              className="flex-1"
                            >
                              {resettingPassword ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Resetting...</> : "Confirm Reset"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { setShowResetForm(false); setResetPassword("") }}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowResetForm(true)}
                            className="flex-1"
                          >
                            <RotateCcw className="size-3.5 mr-1" /> Reset Password
                          </Button>
                          <Button size="sm" onClick={finishWizard} className="flex-1">
                            Done (Esc)
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="text-center space-y-0.5">
                        <h4 className="text-sm font-semibold text-foreground">Create Portal Account</h4>
                        <p className="text-[10px] text-muted-foreground">Allow {firstName} {lastName} to log in to the portal</p>
                      </div>

                      <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Login Email</Label>
                        <Input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="student@school.edu" className="h-9 bg-background" required />
                      </div>
                        <PasswordStrengthInput
                          label="Temporary Password"
                          id="edit-account-password"
                          value={accountPassword}
                          onChange={setAccountPassword}
                          placeholder="Create a temporary password"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-border">
                        <Button size="sm" onClick={handleCreateEditAccount} disabled={creatingAccount}>
                          {creatingAccount ? <><RefreshCw className="size-3.5 animate-spin mr-1" /> Creating...</> : <><UserCheck className="size-3.5 mr-1" /> Create Account</>}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="text-primary hover:bg-primary/10 hover:text-primary">
                          <ArrowLeft className="size-3.5 mr-1" /> Back to Edit
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "SUCCESS" && searchedProfile && (
        <Card className="border-border shadow-sm bg-card max-w-md mx-auto overflow-hidden">
          <CardContent className="py-8 px-6 space-y-5 text-center">
            <div className="size-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Check className="size-7 text-emerald-500" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">RFID Linked Successfully</h2>
              <p className="text-xs text-muted-foreground">
                {accountCreated || editAccountCreated
                  ? "Portal account has been created. The student can now log in."
                  : skippedAccount
                    ? "Card is now associated with this profile. No portal account was created."
                    : "Card is now associated with this clinic profile."}
              </p>
            </div>

            {(accountCreated || editAccountCreated) && (
              <div className="bg-muted rounded-lg p-3 text-left space-y-1 text-xs border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-mono text-foreground">{accountEmail}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-mono text-foreground flex items-center gap-2">
                    {showPassword ? accountPassword : "••••••••"}
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="rounded-md p-1 text-primary transition-colors hover:bg-primary/10">
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(accountPassword); toast.success("Copied!") }} className="rounded-md p-1 text-primary transition-colors hover:bg-primary/10">
                      <Copy className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 border border-border rounded-lg p-4 bg-muted/50 text-left">
              <div className="size-14 rounded-2xl overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center">
                {searchedProfile.clinic_photo_url ? (
                  <img src={searchedProfile.clinic_photo_url} alt="Profile" className="size-full object-cover" />
                ) : (
                  <span className="font-bold bg-muted text-foreground size-full flex items-center justify-center">
                    {searchedProfile.first_name[0]}{searchedProfile.last_name[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 text-xs space-y-0.5">
                <div className="font-semibold text-sm text-foreground">{searchedProfile.first_name} {searchedProfile.last_name}</div>
                <div className="font-mono text-muted-foreground">{searchedProfile.student_number || searchedProfile.employee_number}</div>
                <div className="font-mono text-muted-foreground">{searchedProfile.rfid_uid}</div>
              </div>
            </div>

            <Button className="h-9 w-full text-xs" onClick={resetScanner}>
              Register Another (Esc)
            </Button>
            {resetTimer !== null && (
              <p className="text-[10px] text-muted-foreground animate-pulse">Auto-resetting in {resetTimer}s</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Converts an unknown thrown value into a user-safe message.
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
