"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

function toDateKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export interface CalendarMarker {
    status: "pending" | "confirmed" | "completed" | "cancelled" | string
    /** Short text shown inside the day cell, e.g. "9:30 AM Sophia Cruz" */
    label?: string
}

interface MonthCalendarProps {
    selectedDate?: string // yyyy-mm-dd
    onSelectDate?: (dateKey: string) => void
    markersByDate?: Record<string, CalendarMarker[]>
    disablePast?: boolean
    /** "full" = spacious overview grid, "compact" = smaller grid for embedding in a form */
    size?: "full" | "compact"
}

const STATUS_CHIP: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200/70",
    confirmed: "bg-blue-50 text-blue-700 border border-blue-200/70",
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
    cancelled: "bg-zinc-100 text-zinc-500 border border-zinc-200",
}

const STATUS_BADGE: Record<string, string> = {
    pending: "bg-amber-400",
    confirmed: "bg-blue-500",
    completed: "bg-emerald-500",
    cancelled: "bg-zinc-300",
}

interface DayCell {
    date: Date
    inCurrentMonth: boolean
}

export function MonthCalendar({
    selectedDate,
    onSelectDate,
    markersByDate = {},
    disablePast = false,
    size = "full",
}: MonthCalendarProps) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const initial = selectedDate ? new Date(selectedDate + "T00:00:00") : today
    const [viewYear, setViewYear] = React.useState(initial.getFullYear())
    const [viewMonth, setViewMonth] = React.useState(initial.getMonth())

    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    // Build a full 6x7 grid, including muted leading/trailing days from
    // adjacent months, so the grid height never jumps between months.
    const cells: DayCell[] = []

    for (let i = startWeekday - 1; i >= 0; i--) {
        cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i), inCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ date: new Date(viewYear, viewMonth, d), inCurrentMonth: true })
    }
    let trailing = 1
    while (cells.length < 42) {
        cells.push({ date: new Date(viewYear, viewMonth + 1, trailing), inCurrentMonth: false })
        trailing++
    }

    function goPrevMonth() {
        const m = viewMonth === 0 ? 11 : viewMonth - 1
        const y = viewMonth === 0 ? viewYear - 1 : viewYear
        setViewMonth(m)
        setViewYear(y)
    }

    function goNextMonth() {
        const m = viewMonth === 11 ? 0 : viewMonth + 1
        const y = viewMonth === 11 ? viewYear + 1 : viewYear
        setViewMonth(m)
        setViewYear(y)
    }

    function goToday() {
        setViewYear(today.getFullYear())
        setViewMonth(today.getMonth())
        onSelectDate?.(toDateKey(today))
    }

    const yearOptions = React.useMemo(() => {
        const base = today.getFullYear()
        const years: number[] = []
        for (let y = base - 3; y <= base + 5; y++) years.push(y)
        // Make sure whatever year we're currently viewing is always selectable.
        if (!years.includes(viewYear)) years.push(viewYear)
        return years.sort((a, b) => a - b)
    }, [today, viewYear])

    const cellMinHeight = size === "compact" ? "min-h-14 sm:min-h-16" : "min-h-[92px] sm:min-h-[112px]"
    const maxChips = size === "compact" ? 1 : 2

    return (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-200 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <select
                        value={viewMonth}
                        onChange={(e) => setViewMonth(Number(e.target.value))}
                        className="text-sm font-semibold text-zinc-800 bg-white border border-zinc-200 rounded-md pl-2 pr-6 py-1 cursor-pointer hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    >
                        {MONTH_NAMES.map((m, i) => (
                            <option key={m} value={i}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={viewYear}
                        onChange={(e) => setViewYear(Number(e.target.value))}
                        className="text-sm font-semibold text-zinc-800 bg-white border border-zinc-200 rounded-md pl-2 pr-6 py-1 cursor-pointer hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={goToday}
                        className="text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 rounded px-2 py-1 mr-1 cursor-pointer"
                    >
                        Today
                    </button>
                    <button type="button" onClick={goPrevMonth} className="size-7 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer">
                        <ChevronLeft className="size-4" />
                    </button>
                    <button type="button" onClick={goNextMonth} className="size-7 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer">
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60">
                {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center text-[10px] font-semibold tracking-wide text-zinc-400 py-1.5 uppercase">
                        {size === "compact" ? w.slice(0, 1) : w.slice(0, 3)}
                    </div>
                ))}
            </div>

            {/* Date grid */}
            <div className="grid grid-cols-7">
                {cells.map(({ date, inCurrentMonth }, i) => {
                    const dateKey = toDateKey(date)
                    const isToday = isSameDay(date, today)
                    const isSelected = selectedDate === dateKey
                    const isPast = disablePast && date < today && !isToday
                    const markers = markersByDate[dateKey] || []
                    const isDisabled = isPast || !inCurrentMonth
                    const col = i % 7
                    const row = Math.floor(i / 7)
                    const visibleMarkers = markers.slice(0, maxChips)
                    const overflowCount = markers.length - visibleMarkers.length

                    return (
                        <button
                            key={dateKey + i}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => onSelectDate?.(dateKey)}
                            className={`
                relative flex flex-col items-stretch gap-1 pt-1.5 pb-1.5 px-1 transition-colors text-left
                ${cellMinHeight}
                ${col !== 6 ? "border-r border-zinc-100" : ""}
                ${row !== 5 ? "border-b border-zinc-100" : ""}
                ${!inCurrentMonth ? "bg-zinc-50/40 cursor-default" : isPast ? "cursor-not-allowed" : "cursor-pointer hover:bg-zinc-50"}
                ${isSelected && inCurrentMonth ? "bg-blue-50/70 hover:bg-blue-50/70" : ""}
              `}
                        >
                            <div className="flex items-center justify-between px-0.5">
                                <span
                                    className={`
                    flex items-center justify-center rounded-full text-xs font-medium size-6
                    ${!inCurrentMonth ? "text-zinc-300" : isPast ? "text-zinc-300" : "text-zinc-700"}
                    ${isToday ? "bg-zinc-900/10 text-zinc-900 font-semibold" : ""}
                    ${isSelected && !isToday && inCurrentMonth ? "ring-1 ring-blue-400 text-blue-700" : ""}
                  `}
                                >
                                    {date.getDate()}
                                </span>

                                {markers.length > 0 && inCurrentMonth && (
                                    <span className="flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-zinc-800 text-white text-[10px] font-semibold leading-none">
                                        {markers.length}
                                    </span>
                                )}
                            </div>

                            {visibleMarkers.length > 0 && inCurrentMonth && (
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                    {visibleMarkers.map((m, idx) => (
                                        <span
                                            key={idx}
                                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate ${STATUS_CHIP[m.status] || "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}
                                            title={m.label}
                                        >
                                            <span className={`size-1.5 rounded-full shrink-0 ${STATUS_BADGE[m.status] || "bg-zinc-300"}`} />
                                            <span className="truncate">{m.label || m.status}</span>
                                        </span>
                                    ))}
                                    {overflowCount > 0 && (
                                        <span className="text-[9px] leading-none text-zinc-400 font-medium px-1">
                                            +{overflowCount} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}