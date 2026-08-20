"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <div className="flex flex-col items-center text-center max-w-md">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-6" />
                </div>
                <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                    An unexpected error occurred. Please try again.
                </p>
                <Button
                    onClick={() => reset()}
                    className="cursor-pointer"
                >
                    Try again
                </Button>
            </div>
        </div>
    )
}