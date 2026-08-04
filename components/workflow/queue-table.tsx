import { EmptyState } from "@/components/empty-state"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface QueueTableProps {
  columns: string[]
  rows: Array<{ id: string; values: string[]; action?: { label: string; href: string } }>
  emptyMessage: string
}

export function QueueTable({ columns, rows, emptyMessage }: QueueTableProps) {
  if (rows.length === 0) return <EmptyState title="Nothing to show" description={emptyMessage} />
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30 transition-colors">
              {row.values.map((value, index) => (
                <td key={`${row.id}-${index}`} className="px-4 py-3">
                  {value || "—"}
                </td>
              ))}
              {row.action && (
                <td className="px-4 py-3 text-right">
                  <Link href={row.action.href}>
                    <Button size="xs" variant="outline" className="text-xs bg-white hover:bg-zinc-100">
                      {row.action.label}
                    </Button>
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
