"use client";

import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

import {
  getInventoryQueue,
  type InventoryMedicine,
} from "@/actions/inventory/workflow-queries";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Shows Doctors the same current aggregate stock used by prescribing.
export default function DoctorMedicineStockPage() {
  const [medicines, setMedicines] = useState<InventoryMedicine[]>([]);
  const [loading, setLoading] = useState(true);

  // Reloads approved medicine stock without exposing stock mutation controls.
  const loadInventory = useCallback(async () => {
    setLoading(true);
    const result = await getInventoryQueue();
    if (result.error) toast.error(result.error);
    setMedicines(result.medicines);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadInventory]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Approved medicines and their current aggregate quantities."
        title="Medicine Stock"
      />

      <div className="border border-border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : medicines.length === 0 ? (
          <div className="p-6">
            <EmptyState
              description="No approved medicines are available."
              icon={Package}
              title="No medicines found"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Available stock</TableHead>
                  <TableHead>Minimum level</TableHead>
                  <TableHead>Nearest expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicines.map((medicine) => {
                  const status =
                    medicine.stock === 0
                      ? { label: "Out of stock", value: "danger" as const }
                      : medicine.stock <= medicine.minimum
                        ? { label: "Low stock", value: "warning" as const }
                        : { label: "In stock", value: "success" as const };
                  return (
                    <TableRow key={medicine.id}>
                      <TableCell className="font-medium">
                        {medicine.name}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {medicine.stock} {medicine.unit}
                      </TableCell>
                      <TableCell>
                        {medicine.minimum} {medicine.unit}
                      </TableCell>
                      <TableCell>
                        {medicine.expiry
                          ? new Date(medicine.expiry).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status.value}>
                          {status.label}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
