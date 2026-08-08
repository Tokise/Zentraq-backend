import * as React from "react"

import { Input } from "@/components/ui/input"

// Renders a locale-aware calendar field using the shared input treatment.
function Calendar({
  onSelect,
  selected,
  ...props
}: Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "onSelect" | "type" | "value"
> & {
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <Input
      {...props}
      onChange={(event) => onSelect(event.target.value)}
      type="date"
      value={selected}
    />
  )
}

export { Calendar }
