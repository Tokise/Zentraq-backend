"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_FULL = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface CalendarMarker {
  status: "pending" | "confirmed" | "completed" | "cancelled" | string;
  /** Short text shown inside the day cell, e.g. "9:30 AM" */
  label?: string;
}

interface MonthCalendarProps {
  selectedDate?: string; // yyyy-mm-dd
  onSelectDate?: (dateKey: string) => void;
  markersByDate?: Record<string, CalendarMarker[]>;
  disablePast?: boolean;
  /** "full" = spacious overview grid, "compact" = smaller grid for embedding in a form */
  size?: "full" | "compact";
}

// Maps appointment statuses to theme-safe event treatments.
const STATUS_EVENT_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    bg: "bg-warning/15",
    text: "text-warning",
    border: "border-l-warning",
    dot: "bg-warning",
  },
  confirmed: {
    bg: "bg-info/15",
    text: "text-info",
    border: "border-l-info",
    dot: "bg-info",
  },
  completed: {
    bg: "bg-success/15",
    text: "text-success",
    border: "border-l-success",
    dot: "bg-success",
  },
  cancelled: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-l-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

interface DayCell {
  date: Date;
  inCurrentMonth: boolean;
}

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  markersByDate = {},
  disablePast = false,
  size = "full",
}: MonthCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = selectedDate ? new Date(selectedDate + "T00:00:00") : today;
  const [viewYear, setViewYear] = React.useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Build 6×7 grid
  const cells: DayCell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({
      date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i),
      inCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(viewYear, viewMonth, d),
      inCurrentMonth: true,
    });
  }
  let trailing = 1;
  while (cells.length < 42) {
    cells.push({
      date: new Date(viewYear, viewMonth + 1, trailing),
      inCurrentMonth: false,
    });
    trailing++;
  }

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate?.(toDateKey(today));
  }

  const isCompact = size === "compact";
  const weekdays = isCompact ? WEEKDAYS_SHORT : WEEKDAYS_FULL;
  const maxChips = isCompact ? 1 : 4;

  return (
    <div className="select-none overflow-hidden rounded-xl bg-card shadow-sm">
      {/* ──── Header ──── */}
      <div className="flex items-center justify-between px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {MONTH_NAMES[viewMonth]}{" "}
            <span className="font-normal text-muted-foreground">
              {viewYear}
            </span>
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Today
        </button>
      </div>

      {/* ──── Weekday header ──── */}
      <div className="grid grid-cols-7 border-t border-border">
        {weekdays.map((w, i) => (
          <div
            key={w + i}
            className={`text-center text-[11px] font-semibold tracking-wider py-2.5 ${
              i === 0 || i === 6
                ? "text-muted-foreground"
                : "text-muted-foreground"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* ──── Date grid ──── */}
      <div className="grid grid-cols-7 border-t border-border">
        {cells.map(({ date, inCurrentMonth }, i) => {
          const dateKey = toDateKey(date);
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate === dateKey;
          const isPast = disablePast && date < today && !isToday;
          const markers = markersByDate[dateKey] || [];
          const isDisabled = isPast || !inCurrentMonth;
          const col = i % 7;
          const row = Math.floor(i / 7);
          const isWeekend = col === 0 || col === 6;
          const visibleMarkers = markers.slice(0, maxChips);
          const overflowCount = markers.length - visibleMarkers.length;

          const cellHeight = isCompact ? "min-h-12" : "min-h-[140px]";

          return (
            <button
              key={dateKey + i}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate?.(dateKey)}
              className={`
                                relative flex flex-col items-stretch gap-0.5 text-left transition-all duration-150
                                ${cellHeight}
                                ${col !== 6 ? "border-r border-border" : ""}
                                ${row !== 5 ? "border-b border-border" : ""}
                                ${
                                  !inCurrentMonth
                                    ? "bg-muted/30 cursor-default"
                                    : isPast
                                      ? "cursor-not-allowed bg-card"
                                      : "cursor-pointer hover:bg-muted"
                                }
                                ${isSelected && inCurrentMonth ? "bg-muted hover:bg-muted" : ""}
                            `}
            >
              {/* Day number */}
              <div
                className={`flex items-center justify-center pt-1.5 ${isCompact ? "pb-0.5" : "pb-1"}`}
              >
                <span
                  className={`
                                        flex items-center justify-center rounded-full text-[13px] font-medium
                                        ${isCompact ? "size-7" : "size-7"}
                                        ${
                                          !inCurrentMonth
                                            ? "text-muted-foreground/55"
                                            : isPast
                                              ? "text-muted-foreground/55"
                                              : isWeekend
                                                ? "text-muted-foreground"
                                                : "text-foreground"
                                        }
                                        ${
                                          isToday
                                            ? "border border-primary bg-primary-soft text-primary font-semibold"
                                            : ""
                                        }
                                        ${
                                          isSelected &&
                                          !isToday &&
                                          inCurrentMonth
                                            ? "border border-primary/40 bg-primary-soft/60 text-primary font-semibold"
                                            : ""
                                        }
                                    `}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Event chips */}
              {!isCompact && visibleMarkers.length > 0 && inCurrentMonth && (
                <div className="flex flex-col gap-[3px] px-1 pb-1">
                  {visibleMarkers.map((m, idx) => {
                    const colors =
                      STATUS_EVENT_COLORS[m.status] ||
                      STATUS_EVENT_COLORS.cancelled;
                    return (
                      <span
                        key={idx}
                        className={`
                                                    flex items-center gap-1 rounded-md px-1.5 py-[3px]
                                                    text-[10px] font-medium leading-tight truncate
                                                    border-l-2 ${colors.bg} ${colors.text} ${colors.border}
                                                    transition-colors
                                                `}
                        title={m.label}
                      >
                        <span className="truncate">{m.label || m.status}</span>
                      </span>
                    );
                  })}
                  {overflowCount > 0 && (
                    <span className="text-[10px] font-medium text-primary px-1.5 leading-tight">
                      +{overflowCount} more
                    </span>
                  )}
                </div>
              )}

              {/* Compact mode: dot indicators */}
              {isCompact && markers.length > 0 && inCurrentMonth && (
                <div className="flex items-center justify-center gap-[3px] pb-1">
                  {markers.slice(0, 3).map((m, idx) => {
                    const colors =
                      STATUS_EVENT_COLORS[m.status] ||
                      STATUS_EVENT_COLORS.cancelled;
                    return (
                      <span
                        key={idx}
                        className={`size-[5px] rounded-full ${colors.dot}`}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
