"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Check, X } from "lucide-react"
import { checkPassword } from "@/lib/validation/password"

interface PasswordStrengthInputProps {
    label?: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    id?: string
    autoComplete?: string
    disabled?: boolean
    showChecklist?: boolean
}

export function PasswordStrengthInput({
    label = "Password",
    value,
    onChange,
    placeholder = "Enter password",
    id = "password",
    autoComplete = "new-password",
    disabled,
    showChecklist = true,
}: PasswordStrengthInputProps) {
    const [visible, setVisible] = React.useState(false)
    const [touched, setTouched] = React.useState(false)
    const { results, valid } = checkPassword(value)
    const metCount = results.filter((r) => r.met).length

    const strengthLabel =
        value.length === 0
            ? ""
            : metCount <= 2
                ? "Weak"
                : metCount <= 4
                    ? "Fair"
                    : "Strong"

    const strengthColor =
        metCount <= 2 ? "bg-red-400" : metCount <= 4 ? "bg-amber-400" : "bg-emerald-500"

    return (
        <div className="space-y-1.5">
            {label && <Label htmlFor={id} className="text-xs">{label}</Label>}
            <div className="relative">
                <Input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setTouched(true)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    className="h-9 pr-9"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVisible(!visible)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                    {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
            </div>

            {value.length > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="flex-1 h-1 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${strengthColor}`}
                            style={{ width: `${(metCount / results.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400 w-9 text-right">{strengthLabel}</span>
                </div>
            )}

            {showChecklist && (touched || value.length > 0) && (
                <ul className="grid grid-cols-1 gap-0.5 pt-1">
                    {results.map((r) => (
                        <li
                            key={r.key}
                            className={`flex items-center gap-1.5 text-[11px] transition-colors ${r.met ? "text-emerald-600" : "text-zinc-400"
                                }`}
                        >
                            {r.met ? <Check className="size-3" /> : <X className="size-3" />}
                            {r.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}