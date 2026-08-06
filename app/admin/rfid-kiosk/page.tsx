"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getKioskConsultationHistory,
  getKioskStudentProfile,
  type KioskConsultationSummary,
} from "@/actions/rfid/kiosk";
import { getAppointmentsOverviewAction } from "@/actions/admin/appointments-admin";
import {
  getStudentDocumentsAction,
  type StudentDocumentRow,
} from "@/actions/admin/records-admin";
import {
  getPatientMedicalRecord,
  type PatientMedicalRecord,
} from "@/actions/clinical/records";
import { MonthCalendar } from "@/components/month-calendar";
import { SensitiveField } from "@/components/sensitive-field";
import { AttachmentCarousel } from "@/components/medical/attachment-carousel";
import {
  Loader2,
  Scan,
  Calendar,
  Stethoscope,
  FileText,
  ChevronRight,
  UserRound,
  RotateCcw,
  Syringe,
} from "lucide-react";

interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  employeeNumber: string | null;
  department: string | null;
  clinicPhotoUrl: string | null;
}

export default function AdminRfidKioskPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [rfidInput, setRfidInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<
    Array<{
      id: string;
      scheduled_date: string | null;
      scheduled_time: string | null;
      reason: string;
      status: string;
    }>
  >([]);
  const [selectedAppointment, setSelectedAppointment] = useState<{
    id: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    reason: string;
    status: string;
  } | null>(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [record, setRecord] = useState<PatientMedicalRecord | null>(null);
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([]);
  const [consultationHistory, setConsultationHistory] = useState<
    KioskConsultationSummary[]
  >([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const uid = rfidInput.trim();
    if (!uid || loading) return;

    setLoading(true);
    try {
      const result = await getKioskStudentProfile(uid);
      if (result.error) {
        toast.error(result.error);
        resetScanner();
        return;
      }

      if (result.profile) {
        const scannedProfile = result.profile as PatientProfile;
        setProfile(scannedProfile);
        setLoadingSummary(true);
        setShowProfileModal(true);

        const apptRes = await getAppointmentsOverviewAction();
        if (!apptRes.error && apptRes.appointments) {
          const patientAppts = apptRes.appointments.filter(
            (appointment) =>
              appointment.patient_type === "student" &&
              appointment.patient_identifier === scannedProfile.studentNumber,
          );
          setAppointments(patientAppts.slice(0, 5));
        }
        const [recordResult, documentsResult, consultationsResult] =
          await Promise.all([
            getPatientMedicalRecord(scannedProfile.id, "student"),
            getStudentDocumentsAction(scannedProfile.id),
            getKioskConsultationHistory(scannedProfile.id),
          ]);
        if (recordResult.error) toast.error(recordResult.error);
        else setRecord(recordResult.record);
        if (documentsResult.error) toast.error(documentsResult.error);
        else setDocuments(documentsResult.documents);
        if (consultationsResult.error) toast.error(consultationsResult.error);
        else setConsultationHistory(consultationsResult.consultations);
      } else {
        toast.error("Unregistered RFID");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
      setLoadingSummary(false);
      setRfidInput("");
      inputRef.current?.focus();
    }
  }

  function resetScanner() {
    setProfile(null);
    setRfidInput("");
    setAppointments([]);
    setRecord(null);
    setDocuments([]);
    setConsultationHistory([]);
    setShowProfileModal(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const patientType = useMemo(() => {
    if (!profile) return "student";
    return profile.studentNumber ? "student" : "faculty";
  }, [profile]);

  const accent =
    patientType === "student"
      ? { chip: "bg-indigo-50 text-indigo-700 border-indigo-200/80" }
      : { chip: "bg-violet-50 text-violet-700 border-violet-200/80" };

  const idNumber = profile?.studentNumber || profile?.employeeNumber || "—";

  return (
    <div className="w-full flex justify-center px-4 pt-6 pb-10">
      <style>{`
        @keyframes ringPulse {
          0% { transform: scale(0.85); opacity: 0.5; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .result-enter { animation: fadeIn 0.35s ease-out both; }
      `}</style>

      <div className="w-full max-w-xl">
        {/* LEFT: Scan panel */}
        <div className="rounded-2xl border border-border shadow-lg bg-card p-8 flex flex-col items-center justify-center text-center gap-6 min-h-[440px]">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Scan ID to Check In
            </h1>
            <p className="text-sm text-muted-foreground">
              Tap a card or type the ID number below
            </p>
          </div>

          <form onSubmit={handleScan} className="w-full max-w-xs space-y-5">
            <div className="relative flex items-center justify-center py-2">
              <span
                className="absolute size-20 rounded-full border-2 border-primary/30"
                style={{ animation: "ringPulse 2.2s ease-out infinite" }}
              />
              <span
                className="absolute size-20 rounded-full border-2 border-primary/30"
                style={{ animation: "ringPulse 2.2s ease-out infinite 0.7s" }}
              />
              <span
                className="absolute size-20 rounded-full border-2 border-primary/30"
                style={{ animation: "ringPulse 2.2s ease-out infinite 1.4s" }}
              />
              <div className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                {loading ? (
                  <Loader2 className="size-7 animate-spin" />
                ) : (
                  <Scan className="size-7" />
                )}
              </div>
            </div>

            <Input
              ref={inputRef}
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              placeholder="Tap card or type ID here..."
              className="h-14 text-center text-xl font-mono tracking-wider"
              autoFocus
              autoComplete="off"
            />
          </form>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            {loading ? "Scanning..." : "Ready"}
          </div>
        </div>

        {/* RIGHT: Result panel */}
        <div className="hidden rounded-2xl border border-border bg-card p-8 shadow-lg">
          {!profile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
              <div className="size-14 rounded-full bg-muted border border-border flex items-center justify-center">
                <UserRound className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No patient scanned yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Results appear here after a successful scan
                </p>
              </div>
            </div>
          ) : (
            <div className="result-enter flex flex-col h-full">
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-xl overflow-hidden border border-border bg-muted shrink-0">
                  {profile.clinicPhotoUrl ? (
                    <img
                      src={profile.clinicPhotoUrl}
                      alt="Patient"
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src="/student.png"
                      alt="Patient"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-bold text-foreground truncate">
                    {profile.firstName} {profile.lastName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${accent.chip}`}
                    >
                      {patientType}
                    </span>
                    <code className="text-[11px] font-mono text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                      {idNumber}
                    </code>
                  </div>
                  {profile.department && (
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.department}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border my-5" />

              {/* Actions */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Select an action
              </p>
              <div className="space-y-1.5 flex-1">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50/60 transition-colors cursor-pointer text-left"
                  onClick={() => {
                    if (appointments.length > 0) {
                      setSelectedAppointment(appointments[0]);
                      setShowApptModal(true);
                    } else {
                      toast.info("No upcoming appointments");
                    }
                  }}
                >
                  <div className="size-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Calendar className="size-4.5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Appointments
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appointments.length > 0
                        ? `${appointments.length} upcoming`
                        : "None scheduled"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50/60 transition-colors cursor-pointer text-left"
                  onClick={() => {
                    toast.success("Walk-in consultation started");
                    setTimeout(resetScanner, 1500);
                  }}
                >
                  <div className="size-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="size-4.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Walk-in Consultation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Start a new visit
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50/60 transition-colors cursor-pointer text-left"
                  onClick={() => {
                    router.push(
                      `/admin/records/view?id=${profile.id}&type=${patientType}`,
                    );
                    resetScanner();
                  }}
                >
                  <div className="size-9 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <FileText className="size-4.5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Medical Records
                    </p>
                    <p className="text-xs text-muted-foreground">
                      View patient history
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetScanner}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer gap-1.5 mt-3"
              >
                <RotateCcw className="size-3.5" />
                Scan Next
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-h-[90vh] w-[94vw] max-w-none overflow-y-auto sm:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle>
              {profile
                ? `${profile.firstName} ${profile.lastName}`
                : "Student record"}
            </DialogTitle>
            <DialogDescription>
              Clinical information is shown only for the currently authenticated
              clinic staff member.
            </DialogDescription>
          </DialogHeader>
          {loadingSummary ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <div className="w-full space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    <img
                      src={profile.clinicPhotoUrl || "/student.png"}
                      alt={`${profile.firstName} ${profile.lastName}`}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {profile.firstName} {profile.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <SensitiveField
                        value={profile.studentNumber || ""}
                        fieldType="studentNumber"
                        ariaLabel="Student number"
                      />{" "}
                      · {profile.department || "Department not recorded"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowProfileModal(false);
                    router.push(
                      `/admin/records/view?id=${profile.id}&type=student`,
                    );
                  }}
                >
                  Open full record
                </Button>
              </div>
              <div className="space-y-6">
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Appointments</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push("/admin/appointments/calendar")
                      }
                    >
                      Manage
                    </Button>
                  </div>
                  <MonthCalendar
                    size="compact"
                    markersByDate={Object.fromEntries(
                      appointments
                        .filter((appointment) => appointment.scheduled_date)
                        .map((appointment) => [
                          appointment.scheduled_date as string,
                          [
                            {
                              status: appointment.status,
                              label: appointment.scheduled_time?.slice(0, 5),
                            },
                          ],
                        ]),
                    )}
                  />
                  <div className="space-y-2">
                    {appointments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No appointments scheduled.
                      </p>
                    ) : (
                      appointments.map((appointment) => (
                        <button
                          type="button"
                          key={appointment.id}
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowApptModal(true);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border p-3 text-left hover:bg-muted"
                        >
                          <span className="text-sm font-medium">
                            {appointment.reason || "Clinic appointment"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {appointment.scheduled_date}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </section>
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Immunizations</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/records/immunization?id=${profile.id}&type=student`,
                        )
                      }
                    >
                      Manage immunizations
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        Immunizations
                      </p>
                      {record?.immunizations.length ? (
                        record.immunizations.map((immunization) => (
                          <p
                            key={immunization.id}
                            className="mt-1 text-sm font-medium"
                          >
                            {immunization.vaccine_name}
                            {immunization.dose_number
                              ? ` · Dose ${immunization.dose_number}`
                              : ""}
                          </p>
                        ))
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No immunizations recorded.
                        </p>
                      )}
                    </div>
                    <div className="hidden rounded-md border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        Medical history
                      </p>
                      {record?.medical_history.length ? (
                        record.medical_history.map((history) => (
                          <p
                            key={history.id}
                            className="mt-1 text-sm font-medium"
                          >
                            {history.condition}{" "}
                            <span className="font-normal text-muted-foreground">
                              · {history.status}
                            </span>
                          </p>
                        ))
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No medical history recorded.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {record?.immunizations.slice(0, 3).map((immunization) => (
                      <div
                        key={immunization.id}
                        className="flex items-center gap-2 rounded-md border border-border p-3"
                      >
                        <Syringe className="size-4 text-muted-foreground" />
                        <span className="text-sm">
                          {immunization.vaccine_name}
                        </span>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground">
                        No immunizations recorded.
                      </p>
                    )}
                  </div>
                </section>
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Medical history</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/records/history?id=${profile.id}&type=student`,
                        )
                      }
                    >
                      View medical history
                    </Button>
                  </div>
                  {record?.medical_history.length ? (
                    <div className="space-y-2">
                      {record.medical_history.map((history) => (
                        <div
                          key={history.id}
                          className="rounded-md border border-border p-3"
                        >
                          <p className="text-sm font-medium">
                            {history.condition}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Status: {history.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No medical history recorded.
                    </p>
                  )}
                </section>
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Record attachments</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/records/attachments?id=${profile.id}&type=student`,
                        )
                      }
                    >
                      Manage record attachments
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No attachments found.
                    </p>
                  ) : (
                    <AttachmentCarousel attachments={documents} />
                  )}
                </section>
                <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Past consultations</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/visits/history?patient=${profile.id}`,
                        )
                      }
                    >
                      View history
                    </Button>
                  </div>
                  {consultationHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No past consultations found.
                    </p>
                  ) : (
                    consultationHistory.slice(0, 4).map((consultation) => (
                      <div
                        key={consultation.id}
                        className="rounded-md border border-border p-3"
                      >
                        <p className="text-sm font-medium">
                          {consultation.complaint || "Clinical consultation"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {consultation.notes || "No clinical notes recorded."}
                        </p>
                      </div>
                    ))
                  )}
                </section>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={resetScanner}>
              Close and scan next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Modal */}
      <Dialog open={showApptModal} onOpenChange={setShowApptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              {selectedAppointment?.scheduled_date &&
                new Date(selectedAppointment.scheduled_date).toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" },
                )}
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Date</p>
                  <p className="font-medium">
                    {selectedAppointment.scheduled_date
                      ? new Date(
                          selectedAppointment.scheduled_date,
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Time</p>
                  <p className="font-medium">
                    {selectedAppointment.scheduled_time
                      ? selectedAppointment.scheduled_time.slice(0, 5)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Status</p>
                  <p className="font-medium capitalize">
                    {selectedAppointment.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Reason</p>
                  <p className="font-medium">
                    {selectedAppointment.reason || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApptModal(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowApptModal(false);
                toast.success("Redirecting to appointment...");
              }}
              className="cursor-pointer"
            >
              Go to Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
