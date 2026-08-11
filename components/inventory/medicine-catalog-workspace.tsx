"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  getMedicineCatalogItemsAction,
  reviewMedicineCatalogItemAction,
  saveMedicineCatalogItemAction,
  type MedicineCatalogItem,
} from "@/actions/inventory/medicine-catalog";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CatalogRole = "admin" | "nurse";

const emptyForm = {
  id: null as string | null,
  genericName: "",
  brandName: "",
  category: "",
  unit: "",
  minimumStock: "10",
  isControlled: false,
  isActive: true,
};

// Renders approval-aware medicine catalog management for Admin and Nurse.
export function MedicineCatalogWorkspace({ role }: { role: CatalogRole }) {
  const [medicines, setMedicines] = useState<MedicineCatalogItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reloads the minimized catalog and current stock totals.
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const result = await getMedicineCatalogItemsAction();
    if (result.error) toast.error(result.error);
    setMedicines(result.medicines);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCatalog(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-US");
    if (!query) return medicines;
    return medicines.filter((medicine) =>
      [medicine.genericName, medicine.brandName, medicine.category, medicine.unit]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("en-US").includes(query)),
    );
  }, [medicines, search]);

  // Opens one catalog item in the editor without changing stock.
  function editMedicine(medicine: MedicineCatalogItem) {
    setForm({
      id: medicine.id,
      genericName: medicine.genericName,
      brandName: medicine.brandName ?? "",
      category: medicine.category ?? "",
      unit: medicine.unit,
      minimumStock: String(medicine.minimumStock),
      isControlled: medicine.isControlled,
      isActive: medicine.isActive,
    });
  }

  // Saves catalog metadata while database policy derives approval status.
  async function saveMedicine() {
    setSaving(true);
    const result = await saveMedicineCatalogItemAction({
      id: form.id,
      generic_name: form.genericName,
      brand_name: form.brandName || undefined,
      category: form.category || undefined,
      unit: form.unit,
      min_stock_level: Number(form.minimumStock),
      is_controlled: form.isControlled,
      is_active: form.isActive,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      role === "nurse" && form.isControlled
        ? "Controlled medicine submitted for Admin approval."
        : "Medicine catalog saved.",
    );
    setForm(emptyForm);
    await loadCatalog();
  }

  // Applies an Admin approval decision to one controlled submission.
  async function reviewMedicine(id: string, approved: boolean) {
    const result = await reviewMedicineCatalogItemAction({ id, approved });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(approved ? "Medicine approved." : "Medicine rejected.");
    await loadCatalog();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage products separately from stock receipt and dispensing."
        title="Medicine Catalog"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Edit medicine" : "Add medicine"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-generic-name">Generic name</Label>
              <Input
                id="catalog-generic-name"
                maxLength={200}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    genericName: event.target.value,
                  }))
                }
                value={form.genericName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-brand-name">Brand name</Label>
              <Input
                id="catalog-brand-name"
                maxLength={200}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    brandName: event.target.value,
                  }))
                }
                value={form.brandName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-category">Category</Label>
              <Input
                id="catalog-category"
                maxLength={100}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                value={form.category}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-unit">Unit</Label>
              <Input
                id="catalog-unit"
                maxLength={50}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
                placeholder="tablet, bottle, vial"
                value={form.unit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-minimum-stock">Minimum stock</Label>
              <Input
                id="catalog-minimum-stock"
                min={0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minimumStock: event.target.value,
                  }))
                }
                type="number"
                value={form.minimumStock}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                checked={form.isControlled}
                className="size-4 accent-primary"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isControlled: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Controlled medicine
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                checked={form.isActive}
                className="size-4 accent-primary"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Active catalog item
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            {role === "nurse"
              ? "Non-controlled products are available immediately. Controlled products require Admin approval."
              : "Admin saves are approved immediately. Stock is managed in the Restock workflow."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                saving ||
                !form.genericName.trim() ||
                !form.unit.trim() ||
                !form.minimumStock
              }
              onClick={() => void saveMedicine()}
              type="button"
            >
              <Plus className="size-4" />
              {saving ? "Saving..." : "Save medicine"}
            </Button>
            {form.id && (
              <Button
                onClick={() => setForm(emptyForm)}
                type="button"
                variant="outline"
              >
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Catalog products</CardTitle>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search medicine catalog"
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, brand, category, or unit"
              value={search}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((medicine) => (
                <TableRow key={medicine.id}>
                  <TableCell>
                    <p className="font-medium">{medicine.genericName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[medicine.brandName, medicine.unit]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </TableCell>
                  <TableCell>{medicine.category ?? "—"}</TableCell>
                  <TableCell>
                    {medicine.availableStock} / minimum {medicine.minimumStock}
                  </TableCell>
                  <TableCell>
                    {medicine.isControlled ? "Controlled" : "Standard"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        medicine.approvalStatus === "approved"
                          ? "success"
                          : medicine.approvalStatus === "pending"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {medicine.approvalStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        aria-label={`Edit ${medicine.genericName}`}
                        onClick={() => editMedicine(medicine)}
                        size="sm"
                        type="button"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      {role === "admin" &&
                        medicine.isControlled &&
                        medicine.approvalStatus === "pending" && (
                          <>
                            <Button
                              onClick={() =>
                                void reviewMedicine(medicine.id, true)
                              }
                              size="sm"
                              type="button"
                            >
                              <Check className="size-4" />
                              Approve
                            </Button>
                            <Button
                              onClick={() =>
                                void reviewMedicine(medicine.id, false)
                              }
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              <X className="size-4" />
                              Reject
                            </Button>
                          </>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell className="py-10 text-center" colSpan={6}>
                    No medicine catalog items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
