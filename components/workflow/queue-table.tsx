import { EmptyState } from "@/components/empty-state"

interface QueueTableProps {
  columns: string[]
  rows: Array<{ id: string; values: string[] }>
  emptyMessage: string
}

export function QueueTable({ columns, rows, emptyMessage }: QueueTableProps) {
  if (rows.length === 0) return <EmptyState title="Nothing to show" description={emptyMessage} />
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t">{row.values.map((value, index) => <td key={`${row.id}-${index}`} className="px-4 py-3">{value || "—"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
