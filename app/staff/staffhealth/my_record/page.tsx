"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getStaffProfileAction } from "@/actions/staff/profile";
import {
  getStaffMedicalHistory,
  addStaffMedicalHistory,
} from "@/actions/clinical/staff-records";
import {
  getStaffAllergies,
  addStaffAllergy,
} from "@/actions/clinical/staff-records";
import {
  getStaffMedications,
  addStaffMedication,
} from "@/actions/clinical/staff-records";
import {
  getStaffImmunizations,
  addStaffImmunization,
} from "@/actions/clinical/staff-records";
import {
  uploadStaffDocumentAction,
  getStaffDocumentsAction,
  deleteStaffDocumentAction,
} from "@/actions/admin/staff-documents";
import { AttachmentCarousel } from "@/components/medical/attachment-carousel";

export default function StaffMyRecordPage() {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [immunizations, setImmunizations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [historyForm, setHistoryForm] = useState({
    condition_name: "",
    diagnosed_date: "",
    status: "active",
    notes: "",
  });
  const [allergyForm, setAllergyForm] = useState({
    allergen: "",
    reaction: "",
    severity: "",
    notes: "",
  });
  const [medicationForm, setMedicationForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "",
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [immunizationForm, setImmunizationForm] = useState<{
    vaccine_name: string;
    administered_date: string;
    dose_number: number | undefined;
    lot_number: string;
    notes: string;
  }>({
    vaccine_name: "",
    administered_date: "",
    dose_number: undefined,
    lot_number: "",
    notes: "",
  });
  const [documentType, setDocumentType] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        profileRes,
        historyRes,
        allergiesRes,
        medicationsRes,
        immunizationsRes,
        documentsRes,
      ] = await Promise.all([
        getStaffProfileAction(),
        getStaffMedicalHistory(""),
        getStaffAllergies(""),
        getStaffMedications(""),
        getStaffImmunizations(""),
        getStaffDocumentsAction(),
      ]);
      if (profileRes.profile) setProfile(profileRes.profile);
      if (historyRes.error) toast.error(historyRes.error);
      else setHistory(historyRes.history);
      if (allergiesRes.error) toast.error(allergiesRes.error);
      else setAllergies(allergiesRes.allergies);
      if (medicationsRes.error) toast.error(medicationsRes.error);
      else setMedications(medicationsRes.medications);
      if (immunizationsRes.error) toast.error(immunizationsRes.error);
      else setImmunizations(immunizationsRes.immunizations);
      if (documentsRes.error) toast.error(documentsRes.error);
      else setDocuments(documentsRes.documents);
    } catch (err: any) {
      toast.error(err.message || "Failed to load medical record");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddHistory = async () => {
    if (!historyForm.condition_name.trim())
      return toast.error("Condition name is required");
    setSubmitting(true);
    const res = await addStaffMedicalHistory("", historyForm);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("History added");
      setHistoryForm({
        condition_name: "",
        diagnosed_date: "",
        status: "active",
        notes: "",
      });
      fetchData();
    }
  };

  const handleAddAllergy = async () => {
    if (!allergyForm.allergen.trim())
      return toast.error("Allergen is required");
    setSubmitting(true);
    const res = await addStaffAllergy("", allergyForm);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Allergy added");
      setAllergyForm({ allergen: "", reaction: "", severity: "", notes: "" });
      fetchData();
    }
  };

  const handleAddMedication = async () => {
    if (!medicationForm.medicine_name.trim())
      return toast.error("Medicine name is required");
    setSubmitting(true);
    const res = await addStaffMedication("", medicationForm);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Medication added");
      setMedicationForm({
        medicine_name: "",
        dosage: "",
        frequency: "",
        start_date: "",
        end_date: "",
        notes: "",
      });
      fetchData();
    }
  };

  const handleAddImmunization = async () => {
    if (!immunizationForm.vaccine_name.trim())
      return toast.error("Vaccine name is required");
    setSubmitting(true);
    const res = await addStaffImmunization("", immunizationForm);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Immunization added");
      setImmunizationForm({
        vaccine_name: "",
        administered_date: "",
        dose_number: undefined,
        lot_number: "",
        notes: "",
      });
      fetchData();
    }
  };

  const handleUploadDocument = async () => {
    if (!documentType || !documentFile)
      return toast.error("Document type and file are required");
    setSubmitting(true);
    const formData = new FormData();
    formData.append("staffId", "");
    formData.append("documentType", documentType);
    formData.append("file", documentFile);
    const res = await uploadStaffDocumentAction(formData);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Document uploaded");
      setDocumentType("");
      setDocumentFile(null);
      // Optimistically add the new document to the list
      const optimisticDoc = {
        id: `temp-${Date.now()}`,
        document_type: documentType,
        file_name: documentFile.name,
        file_url: URL.createObjectURL(documentFile),
        mime_type: documentFile.type,
        file_size: documentFile.size,
        staff_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
        staff_number: profile?.employee_number || null,
        uploaded_at: new Date().toISOString(),
      };
      setDocuments([optimisticDoc, ...documents]);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await deleteStaffDocumentAction(id);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Document deleted");
      fetchData();
    }
  };

  const activeDocuments = documents;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Health Record"
        description="Your personal medical information."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Medical History</TabsTrigger>
            <TabsTrigger value="allergies">Allergies</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
            <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Personal Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="text-sm font-medium">
                      {profile
                        ? `${profile.first_name} ${profile.last_name}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Employee Number
                    </p>
                    <p className="text-sm font-medium">
                      {profile?.employee_number || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-medium">
                      {profile?.department || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Position</p>
                    <p className="text-sm font-medium">
                      {profile?.position || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">
                      {profile?.phone || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">
                      {profile?.email || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Add Medical History</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Condition name"
                    value={historyForm.condition_name}
                    onChange={(e) =>
                      setHistoryForm({
                        ...historyForm,
                        condition_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={historyForm.diagnosed_date}
                    onChange={(e) =>
                      setHistoryForm({
                        ...historyForm,
                        diagnosed_date: e.target.value,
                      })
                    }
                  />
                  <select
                    value={historyForm.status}
                    onChange={(e) =>
                      setHistoryForm({ ...historyForm, status: e.target.value })
                    }
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="chronic">Chronic</option>
                  </select>
                  <Input
                    placeholder="Notes"
                    value={historyForm.notes}
                    onChange={(e) =>
                      setHistoryForm({ ...historyForm, notes: e.target.value })
                    }
                  />
                </div>
                <Button
                  onClick={handleAddHistory}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  Add
                </Button>
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {h.condition_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.diagnosed_date || "No date"} • {h.status}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {h.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allergies">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Add Allergy</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Allergen"
                    value={allergyForm.allergen}
                    onChange={(e) =>
                      setAllergyForm({
                        ...allergyForm,
                        allergen: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Reaction"
                    value={allergyForm.reaction}
                    onChange={(e) =>
                      setAllergyForm({
                        ...allergyForm,
                        reaction: e.target.value,
                      })
                    }
                  />
                  <select
                    value={allergyForm.severity}
                    onChange={(e) =>
                      setAllergyForm({
                        ...allergyForm,
                        severity: e.target.value,
                      })
                    }
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Severity</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                  <Input
                    placeholder="Notes"
                    value={allergyForm.notes}
                    onChange={(e) =>
                      setAllergyForm({ ...allergyForm, notes: e.target.value })
                    }
                  />
                </div>
                <Button
                  onClick={handleAddAllergy}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  Add
                </Button>
                <div className="space-y-2">
                  {allergies.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{a.allergen}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.reaction || "No reaction"} •{" "}
                          {a.severity || "Unknown"}
                        </p>
                      </div>
                      {a.severity && (
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {a.severity}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medications">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Add Medication</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Medicine name"
                    value={medicationForm.medicine_name}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        medicine_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Dosage"
                    value={medicationForm.dosage}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        dosage: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Frequency"
                    value={medicationForm.frequency}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        frequency: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={medicationForm.start_date}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        start_date: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={medicationForm.end_date}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        end_date: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Notes"
                    value={medicationForm.notes}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
                <Button
                  onClick={handleAddMedication}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  Add
                </Button>
                <div className="space-y-2">
                  {medications.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{m.medicine_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.dosage || "No dosage"} •{" "}
                          {m.frequency || "No frequency"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="immunizations">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Add Immunization</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Vaccine name"
                    value={immunizationForm.vaccine_name}
                    onChange={(e) =>
                      setImmunizationForm({
                        ...immunizationForm,
                        vaccine_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={immunizationForm.administered_date}
                    onChange={(e) =>
                      setImmunizationForm({
                        ...immunizationForm,
                        administered_date: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Dose number"
                    value={immunizationForm.dose_number ?? ""}
                    onChange={(e) =>
                      setImmunizationForm({
                        ...immunizationForm,
                        dose_number: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <Input
                    placeholder="Lot number"
                    value={immunizationForm.lot_number}
                    onChange={(e) =>
                      setImmunizationForm({
                        ...immunizationForm,
                        lot_number: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Notes"
                    value={immunizationForm.notes}
                    onChange={(e) =>
                      setImmunizationForm({
                        ...immunizationForm,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
                <Button
                  onClick={handleAddImmunization}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  Add
                </Button>
                <div className="space-y-2">
                  {immunizations.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{i.vaccine_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.administered_date || "No date"} • Dose{" "}
                          {i.dose_number || "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Upload Document</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Document type"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  />
                  <Input
                    type="file"
                    accept=".pdf,.jpeg,.jpg,.png"
                    onChange={(e) =>
                      setDocumentFile(e.target.files?.[0] || null)
                    }
                  />
                </div>
                <Button
                  onClick={handleUploadDocument}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="size-3.5 mr-1" />
                  )}
                  Upload
                </Button>
                {activeDocuments.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="space-y-2 rounded-md border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {doc.document_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {doc.file_name}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-red-600"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        {doc.file_url && (
                          <AttachmentCarousel attachments={[doc]} compact />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
