"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PackagePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { receiveMedicineStockAction } from "@/actions/inventory/medicine-stock";
import {
  getInventoryQueue,
  type InventoryMedicine,
} from "@/actions/inventory/workflow-queries";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableCombobox } from "@/components/ui/combobox";
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

interface RestockMedicineWorkspaceProps {
  initialMedicineId?: string;
  role: "admin" | "nurse";
}

// Returns tomorrow as a date-input minimum without relying on free-form input.
function tomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

// Renders one stock-receipt workflow with low-stock prioritization.
export function RestockMedicineWorkspace({
  initialMedicineId,
  role,
}: RestockMedicineWorkspaceProps) {
  const [medicines, setMedicines] = useState<InventoryMedicine[]>([]);
  const [medicineId, setMedicineId] = useState(initialMedicineId ?? "");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [location, setLocation] = useState("Clinic pharmacy");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reloads catalog-backed inventory so zero-stock products remain visible.
  const loadInventory = useCallback(async () => {
    setLoading(true);
    const result = await getInventoryQueue();
    if (result.error) toast.error(result.error);
    setMedicines(result.medicines);
    setMedicineId((current) =>
      result.medicines.some((medicine) => medicine.id === current)
        ? current
        : "",
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadInventory]);

  const selectedMedicine = useMemo(
    () => medicines.find((medicine) => medicine.id === medicineId) ?? null,
    [medicineId, medicines],
  );
  const lowStockMedicines = useMemo(
    () =>
      medicines
        .filter((medicine) => medicine.stock <= medicine.minimum)
        .sort((left, right) => left.stock - right.stock),
    [medicines],
  );
  const projectedStock = selectedMedicine
    ? selectedMedicine.stock + Math.max(0, Number(quantity) || 0)
    : 0;

  // Selects one low-stock medicine from the priority table.
  function chooseMedicine(id: string) {
    setMedicineId(id);
    document
      .getElementById("medicine-stock-receipt")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Validates and records one idempotent stock receipt.
  async function receiveStock() {
    if (!medicineId || !quantity || !batchNumber.trim() || !expiryDate) {
      toast.error("Complete the medicine, quantity, batch, and expiry fields.");
      return;
    }

    setSaving(true);
    const result = await receiveMedicineStockAction({
      requestId,
      medicineId,
      quantity: Number(quantity),
      batchNumber,
      expiryDate,
      location,
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Medicine stock received.");
    setQuantity("");
    setBatchNumber("");
    setExpiryDate("");
    setRequestId(crypto.randomUUID());
    await loadInventory();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Receive stock for approved medicines and review items at or below their minimum level."
        title="Restock Medicine"
      />

      <Card id="medicine-stock-receipt">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackagePlus className="size-4 text-primary" />
            Receive a stock batch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label>Medicine</Label>
              <SearchableCombobox
                ariaLabel="Medicine to restock"
                emptyText="No approved medicine matches your search."
                onValueChange={setMedicineId}
                options={medicines.map((medicine) => ({
                  label: `${medicine.name} — ${medicine.stock} ${medicine.unit} available`,
                  value: medicine.id,
                }))}
                placeholder={loading ? "Loading medicines..." : "Select medicine"}
                searchPlaceholder="Search medicine or brand"
                value={medicineId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${role}-restock-quantity`}>Quantity received</Label>
              <Input
                id={`${role}-restock-quantity`}
                min={1}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
                type="number"
                value={quantity}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${role}-restock-batch`}>Batch number</Label>
              <Input
                id={`${role}-restock-batch`}
                maxLength={100}
                onChange={(event) => setBatchNumber(event.target.value)}
                placeholder="Manufacturer batch"
                value={batchNumber}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${role}-restock-expiry`}>Expiry date</Label>
              <Input
                id={`${role}-restock-expiry`}
                min={tomorrowDate()}
                onChange={(event) => setExpiryDate(event.target.value)}
                type="date"
                value={expiryDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${role}-restock-location`}>Storage location</Label>
              <Input
                id={`${role}-restock-location`}
                maxLength={100}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Clinic pharmacy"
                value={location}
              />
            </div>
          </div>

          {selectedMedicine && (
            <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Current stock</p>
                <p className="mt-1 font-semibold">
                  {selectedMedicine.stock} {selectedMedicine.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Minimum level</p>
                <p className="mt-1 font-semibold">
                  {selectedMedicine.minimum} {selectedMedicine.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Stock after receipt</p>
                <p className="mt-1 font-semibold text-primary">
                  {projectedStock} {selectedMedicine.unit}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={
                saving ||
                !medicineId ||
                !quantity ||
                Number(quantity) <= 0 ||
                !batchNumber.trim() ||
                !expiryDate
              }
              onClick={() => void receiveStock()}
            >
              {saving ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <PackagePlus className="size-4" />
              )}
              Add stock
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restock priority</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">
              Loading inventory…
            </div>
          ) : lowStockMedicines.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              All approved medicines are above their minimum stock levels.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Current stock</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockMedicines.map((medicine) => (
                    <TableRow key={medicine.id}>
                      <TableCell className="font-medium">
                        {medicine.name}
                      </TableCell>
                      <TableCell>
                        {medicine.stock} {medicine.unit}
                      </TableCell>
                      <TableCell>
                        {medicine.minimum} {medicine.unit}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={medicine.stock === 0 ? "danger" : "warning"}
                        >
                          {medicine.stock === 0 ? "Out of stock" : "Low stock"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => chooseMedicine(medicine.id)}
                          size="sm"
                          variant="outline"
                        >
                          Restock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
