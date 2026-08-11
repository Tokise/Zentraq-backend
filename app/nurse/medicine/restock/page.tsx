import { RestockMedicineWorkspace } from "@/components/inventory/restock-medicine-workspace";

interface NurseRestockPageProps {
  searchParams: Promise<{ medicineId?: string | string[] }>;
}

// Shows the Nurse stock-receipt workflow with an optional preselected medicine.
export default async function NurseMedicineRestockPage({
  searchParams,
}: NurseRestockPageProps) {
  const params = await searchParams;
  const initialMedicineId = Array.isArray(params.medicineId)
    ? params.medicineId[0]
    : params.medicineId;

  return (
    <RestockMedicineWorkspace
      initialMedicineId={initialMedicineId}
      role="nurse"
    />
  );
}
