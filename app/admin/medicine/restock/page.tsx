import { RestockMedicineWorkspace } from "@/components/inventory/restock-medicine-workspace";

interface AdminRestockPageProps {
  searchParams: Promise<{ medicineId?: string | string[] }>;
}

// Shows the Admin stock-receipt workflow with an optional preselected medicine.
export default async function AdminRestockPage({
  searchParams,
}: AdminRestockPageProps) {
  const params = await searchParams;
  const initialMedicineId = Array.isArray(params.medicineId)
    ? params.medicineId[0]
    : params.medicineId;

  return (
    <RestockMedicineWorkspace
      initialMedicineId={initialMedicineId}
      role="admin"
    />
  );
}
