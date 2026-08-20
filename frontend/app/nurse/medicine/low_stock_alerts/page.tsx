import { redirect } from "next/navigation";

// Preserves old bookmarks while consolidating low-stock work into Restock.
export default function NurseLowStockAlertsRedirect() {
  redirect("/nurse/medicine/restock");
}
