"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SensitiveFieldProps = {
    value: string
    mask?: string
    revealable?: boolean
    autoHide?: boolean
    autoHideDelay?: number
    className?: string
    ariaLabel?: string
    onReveal?: () => void
}

const DEFAULT_MASK = "••••••••"
const DEFAULT_AUTO_HIDE_DELAY = 30000 // 30 seconds per SAD §14.5

export function SensitiveField({
    value,
    mask = DEFAULT_MASK,
    revealable = true,
    autoHide = true,
    autoHideDelay = DEFAULT_AUTO_HIDE_DELAY,
    className,
    ariaLabel,
    onReveal,
}: SensitiveFieldProps) {
    const [revealed, setRevealed] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const hide = useCallback(() => {
        setRevealed(false)
        clearTimer()
    }, [clearTimer])

    const reveal = useCallback(() => {
        setRevealed(true)
        onReveal?.()
        if (autoHide) {
            clearTimer()
            timerRef.current = setTimeout(hide, autoHideDelay)
        }
    }, [autoHide, autoHideDelay, clearTimer, hide, onReveal])

    const toggle = useCallback(() => {
        if (revealed) {
            hide()
        } else {
            reveal()
        }
    }, [revealed, hide, reveal])

    // Reset to hidden on unmount and reset timer on any interaction
    useEffect(() => {
        return () => {
            clearTimer()
        }
    }, [clearTimer])

    if (!revealable) {
        return (
            <span
                className={cn("font-mono", className)}
                aria-label={ariaLabel}
                aria-hidden="true"
            >
                {mask}
            </span>
        )
    }

    return (
        <span
            className={cn("inline-flex items-center gap-1.5", className)}
            aria-label={ariaLabel}
        >
            <span
                className={cn(
                    "font-mono",
                    revealed ? "text-foreground" : "text-muted-foreground select-none"
                )}
                aria-hidden={!revealed}
            >
                {revealed ? value || "—" : mask}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={toggle}
                aria-label={revealed ? `Hide ${ariaLabel || "sensitive data"}` : `Show ${ariaLabel || "sensitive data"}`}
                title={revealed ? "Hide" : "Show"}
            >
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
        </span>
    )
}