import * as React from "react"

import { cn } from "@/lib/utils"

// Provides a consistent scroll container for dense, keyboard-accessible lists.
function ScrollArea({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  )
}

export { ScrollArea }
