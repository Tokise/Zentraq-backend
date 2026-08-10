"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboboxOption {
  label: string
  value: string
}

interface SearchableComboboxProps {
  ariaLabel: string
  className?: string
  emptyText?: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder?: string
  value: string
}

// Renders an accessible filterable selector for bounded application catalogs.
export function SearchableCombobox({
  ariaLabel,
  className,
  emptyText = "No matching options.",
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Search options",
  value,
}: SearchableComboboxProps) {
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  return (
    <ComboboxPrimitive.Root
      filter={(option, query) =>
        option.label
          .toLocaleLowerCase("en-US")
          .includes(query.trim().toLocaleLowerCase("en-US"))
      }
      items={options}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      onValueChange={(option) => onValueChange(option?.value ?? "")}
      value={selectedOption}
    >
      <ComboboxPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-field px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-placeholder:text-muted-foreground",
          className,
        )}
      >
        <ComboboxPrimitive.Value placeholder={placeholder} />
        <ComboboxPrimitive.Icon>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </ComboboxPrimitive.Icon>
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="isolate z-50"
          sideOffset={4}
        >
          <ComboboxPrimitive.Popup
            aria-label={ariaLabel}
            className="w-(--anchor-width) min-w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <ComboboxPrimitive.Input
                aria-label={`Search ${ariaLabel.toLowerCase()}`}
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder={searchPlaceholder}
              />
            </div>
            <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-64 overflow-y-auto p-1">
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  className="relative flex cursor-default items-center rounded-lg py-2 pr-8 pl-3 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  key={option.value}
                  value={option}
                >
                  <span className="truncate">{option.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
