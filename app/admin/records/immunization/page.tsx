"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, User, Syringe, Plus } from "lucide-react";
import { toast } from "sonner";
import { searchRecordsAction } from "@/actions/admin/records";
import {
  getPatientMedicalRecord,
  addPatientImmunization,
} from "@/actions/clinical/records";

export default function AdminImmunizationPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Record<string, any>>>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [immunizations, setImmunizations] = useState<any[]>([]);
  const [loadingImmunizations, setLoadingImmunizations] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    vaccine_name: "",
    dose_number: "",
    administered_date: "",
    lot_number: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    const type = searchParams.get("type") as "student" | "faculty" | null;
    if (!id || !type) return;
    void getPatientMedicalRecord(id, type).then((res) => {
      if (res.error || !res.record) return;
      setSelected({
        id,
        first_name: res.record.first_name,
        last_name: res.record.last_name,
        student_number: type === "student" ? res.record.identifier : undefined,
        employee_number: type === "faculty" ? res.record.identifier : undefined,
      });
      setImmunizations(res.record.immunizations);
    });
  }, [searchParams]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await searchRecordsAction(query);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
      } else {
        setResults([...res.students, ...res.faculty]);
      }
    } finally {
      setSearching(false);
    }
  }

  async function selectPatient(r: Record<string, any>) {
    setSelected(r);
    setResults([]);
    setQuery("");
    const type = "student_number" in r ? "student" : "faculty";
    setLoadingImmunizations(true);
    try {
      const res = await getPatientMedicalRecord(r.id, type);
      if (res.error) {
        toast.error(res.error);
        setImmunizations([]);
      } else {
        setImmunizations(res.record?.immunizations || []);
      }
    } finally {
      setLoadingImmunizations(false);
    }
  }

  async function handleAddImmunization() {
    if (!selected || !form.vaccine_name.trim()) {
      toast.error("Vaccine name is required");
      return;
    }
    const type = "student_number" in selected ? "student" : "faculty";
    setSubmitting(true);
    try {
      const res = await addPatientImmunization(selected.id, type, {
        vaccine_name: form.vaccine_name,
        administered_date: form.administered_date || undefined,
        dose_number: form.dose_number ? Number(form.dose_number) : undefined,
        lot_number: form.lot_number || undefined,
        notes: form.notes || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Immunization recorded");
        setForm({
          vaccine_name: "",
          dose_number: "",
          administered_date: "",
          lot_number: "",
          notes: "",
        });
        setShowAdd(false);
        selectPatient(selected);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immunization Records"
        description="View and record immunization history for patients."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Find Patient</CardTitle>
          <CardDescription className="text-xs">
            Search by name or ID number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Name, student number, or employee number"
              className="h-9"
            />
            <Button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="shrink-0 cursor-pointer"
            >
              {searching ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Search className="size-3.5 mr-1" />
              )}
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectPatient(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50/50 transition-colors text-left cursor-pointer"
                >
                  <User className="size-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {"student_number" in r
                        ? r.student_number
                        : r.employee_number}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {"student_number" in r ? "Student" : "Faculty"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selected.first_name} {selected.last_name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {"student_number" in selected
                    ? selected.student_number
                    : selected.employee_number}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAdd(!showAdd)}
                className="cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />{" "}
                {showAdd ? "Cancel" : "Add Immunization"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAdd && (
              <div className="mb-6 rounded-lg border border-zinc-200 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Vaccine Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.vaccine_name}
                      onChange={(e) =>
                        setForm({ ...form, vaccine_name: e.target.value })
                      }
                      placeholder="e.g. Influenza, Hepatitis B"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dose Number</Label>
                    <Input
                      type="number"
                      value={form.dose_number}
                      onChange={(e) =>
                        setForm({ ...form, dose_number: e.target.value })
                      }
                      placeholder="1, 2, 3"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Administered Date</Label>
                    <Input
                      type="date"
                      value={form.administered_date}
                      onChange={(e) =>
                        setForm({ ...form, administered_date: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lot Number</Label>
                    <Input
                      value={form.lot_number}
                      onChange={(e) =>
                        setForm({ ...form, lot_number: e.target.value })
                      }
                      className="h-9 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddImmunization}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />{" "}
                      Saving...
                    </>
                  ) : (
                    "Save Immunization"
                  )}
                </Button>
              </div>
            )}

            {loadingImmunizations ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : immunizations.length === 0 ? (
              <div className="py-10 text-center">
                <Syringe className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No immunization records for this patient.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Vaccine</th>
                      <th className="px-4 py-3 font-medium">Dose</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Lot</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {immunizations.map((imm) => (
                      <tr
                        key={imm.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {imm.vaccine_name}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {imm.dose_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {imm.administered_date
                            ? new Date(
                                imm.administered_date,
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-600">
                          {imm.lot_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate">
                          {imm.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
