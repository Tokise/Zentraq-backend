"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type RadioGroupContextValue = {
  name?: string
  onValueChange?: (value: string) => void
  value?: string
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({})

// Groups mutually exclusive choices with native radio semantics.
function RadioGroup({
  className,
  name,
  onValueChange,
  value,
  ...props
}: React.ComponentProps<"div"> & RadioGroupContextValue) {
  return (
    <RadioGroupContext.Provider value={{ name, onValueChange, value }}>
      <div className={cn("grid gap-2", className)} role="radiogroup" {...props} />
    </RadioGroupContext.Provider>
  )
}

// Renders one accessible choice inside a radio group.
function RadioGroupItem({
  className,
  value,
  id,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value"> & {
  value: string
}) {
  const group = React.useContext(RadioGroupContext)
  return (
    <input
      {...props}
      checked={group.value === value}
      className={cn(
        "size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
      id={id}
      name={group.name}
      onChange={() => group.onValueChange?.(value)}
      type="radio"
      value={value}
    />
  )
}

export { RadioGroup, RadioGroupItem }
