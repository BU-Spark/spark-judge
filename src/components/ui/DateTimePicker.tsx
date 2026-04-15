import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { CalendarIcon } from "./AppIcons";

type DateTimePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  stepMinutes?: number;
  disabled?: boolean;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateTimeValue(value: string) {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute)
  ) {
    return null;
  }

  return parsed;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimeValue(date: Date) {
  return `${formatDateValue(date)}T${formatTimeValue(date)}`;
}

function roundToStep(date: Date, stepMinutes: number) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  const remainder = minutes % stepMinutes;

  if (remainder !== 0) {
    rounded.setMinutes(minutes + (stepMinutes - remainder));
  }

  return rounded;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getCalendarDays(month: Date) {
  const monthStart = getMonthStart(month);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
}

function isSameDay(left: Date | null, right: Date | null) {
  if (!left || !right) return false;

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatCalendarLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DateTimePicker({
  label,
  value,
  onChange,
  placeholder = "Select a date",
  stepMinutes = 15,
  disabled = false,
}: DateTimePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const timeTriggerRef = useRef<HTMLButtonElement>(null);
  const timePopoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseDateTimeValue(value), [value]);
  const fallbackDate = useMemo(
    () => roundToStep(new Date(), stepMinutes),
    [stepMinutes]
  );
  const minuteOptions = useMemo(() => {
    const options: number[] = [];

    for (let minute = 0; minute < 60; minute += stepMinutes) {
      options.push(minute);
    }

    return options;
  }, [stepMinutes]);
  const [activePopover, setActivePopover] = useState<"date" | "time" | null>(
    null
  );
  const [datePopoverStyle, setDatePopoverStyle] = useState<CSSProperties>({
    left: 12,
    top: 12,
  });
  const [timePopoverStyle, setTimePopoverStyle] = useState<CSSProperties>({
    left: 12,
    top: 12,
  });
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getMonthStart(selectedDate ?? fallbackDate)
  );

  useEffect(() => {
    setVisibleMonth(getMonthStart(selectedDate ?? fallbackDate));
  }, [selectedDate, fallbackDate]);

  useEffect(() => {
    if (!activePopover) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const clickedTrigger = rootRef.current?.contains(target) ?? false;
      const clickedDatePopover =
        datePopoverRef.current?.contains(target) ?? false;
      const clickedTimePopover =
        timePopoverRef.current?.contains(target) ?? false;

      if (!clickedTrigger && !clickedDatePopover && !clickedTimePopover) {
        setActivePopover(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopover(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePopover]);

  useLayoutEffect(() => {
    if (!activePopover) return;

    const updatePosition = () => {
      const trigger =
        activePopover === "date" ? dateTriggerRef.current : timeTriggerRef.current;
      const popover =
        activePopover === "date" ? datePopoverRef.current : timePopoverRef.current;
      const rect = trigger?.getBoundingClientRect();
      const popoverHeight = popover?.offsetHeight ?? (activePopover === "date" ? 320 : 360);
      const popoverWidth = popover?.offsetWidth ?? (activePopover === "date" ? 304 : 248);

      if (!rect) return;

      const viewportPadding = 12;
      const gap = 8;
      const fitsBelow =
        window.innerHeight - rect.bottom >= popoverHeight + viewportPadding;
      const preferredTop = fitsBelow
        ? rect.bottom + gap
        : rect.top - popoverHeight - gap;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - popoverWidth - viewportPadding
      );
      const maxTop = Math.max(
        viewportPadding,
        window.innerHeight - popoverHeight - viewportPadding
      );

      const nextStyle = {
        left: Math.min(Math.max(rect.left, viewportPadding), maxLeft),
        top: Math.min(Math.max(preferredTop, viewportPadding), maxTop),
      };

      if (activePopover === "date") {
        setDatePopoverStyle(nextStyle);
      } else {
        setTimePopoverStyle(nextStyle);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activePopover, visibleMonth]);

  useEffect(() => {
    if (activePopover !== "time") return;

    const rafId = window.requestAnimationFrame(() => {
      const selectedHourButton = hourListRef.current?.querySelector<HTMLButtonElement>(
        "[data-selected='true']"
      );
      const selectedMinuteButton =
        minuteListRef.current?.querySelector<HTMLButtonElement>(
          "[data-selected='true']"
        );

      if (typeof selectedHourButton?.scrollIntoView === "function") {
        selectedHourButton.scrollIntoView({ block: "center" });
      }

      if (typeof selectedMinuteButton?.scrollIntoView === "function") {
        selectedMinuteButton.scrollIntoView({ block: "center" });
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activePopover, selectedDate]);

  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const today = useMemo(() => new Date(), []);
  const dateButtonLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : placeholder;
  const timeValue = selectedDate ? formatTimeValue(selectedDate) : "";
  const selectedHour = selectedDate?.getHours() ?? fallbackDate.getHours();
  const selectedMinute = selectedDate?.getMinutes() ?? fallbackDate.getMinutes();

  const updateDate = (nextDate: Date) => {
    onChange(formatDateTimeValue(nextDate));
  };

  const handleSelectDay = (day: Date) => {
    const base = selectedDate ?? fallbackDate;
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      base.getHours(),
      base.getMinutes(),
      0,
      0
    );

    updateDate(next);
    setActivePopover(null);
  };

  const handleSelectHour = (hour: number) => {
    const base = selectedDate ?? fallbackDate;
    const next = new Date(base);
    next.setHours(hour, next.getMinutes(), 0, 0);
    updateDate(next);
  };

  const handleSelectMinute = (minute: number) => {
    const base = selectedDate ?? fallbackDate;
    const next = new Date(base);
    next.setMinutes(minute, 0, 0);
    updateDate(next);
  };

  return (
    <div
      ref={rootRef}
      className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]"
    >
      <button
        ref={dateTriggerRef}
        type="button"
        disabled={disabled}
        aria-label={`${label} date`}
        aria-expanded={activePopover === "date"}
        aria-haspopup="dialog"
        onClick={() =>
          setActivePopover((open) => (open === "date" ? null : "date"))
        }
        className={cn(
          "input justify-start gap-2 text-left font-medium",
          !selectedDate && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{dateButtonLabel}</span>
      </button>

      <button
        ref={timeTriggerRef}
        type="button"
        disabled={disabled || !selectedDate}
        aria-label={`${label} time`}
        aria-expanded={activePopover === "time"}
        aria-haspopup="dialog"
        onClick={() =>
          setActivePopover((open) => (open === "time" ? null : "time"))
        }
        className={cn(
          "input justify-between gap-2 text-left font-medium tabular-nums",
          !selectedDate && "text-muted-foreground"
        )}
      >
        <span>{timeValue || "--:--"}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      </button>

      {activePopover === "date" &&
        createPortal(
          <div
            ref={datePopoverRef}
            role="dialog"
            aria-label={`${label} calendar`}
            style={datePopoverStyle}
            className="fixed z-[80] w-[19rem] rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-black/10"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() - 1,
                        1
                      )
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Previous month"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m12.5 4.5-5 5 5 5" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-foreground">
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() + 1,
                        1
                      )
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Next month"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m7.5 4.5 5 5-5 5" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {WEEKDAY_LABELS.map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);
                const isOutsideMonth =
                  day.getMonth() !== visibleMonth.getMonth();

                return (
                  <button
                    key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                    type="button"
                    aria-label={formatCalendarLabel(day)}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectDay(day)}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                      isSelected &&
                        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
                      !isSelected &&
                        !isOutsideMonth &&
                        "text-foreground hover:bg-muted",
                      !isSelected &&
                        isOutsideMonth &&
                        "text-muted-foreground/60 hover:bg-muted/60",
                      isToday &&
                        !isSelected &&
                        "border border-primary/30 text-primary"
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {activePopover === "time" &&
        createPortal(
          <div
            ref={timePopoverRef}
            role="dialog"
            aria-label={`${label} time picker`}
            style={timePopoverStyle}
            className="fixed z-[80] w-[15.5rem] rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-black/10"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Hour
                </p>
                <div
                  ref={hourListRef}
                  className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1 custom-scrollbar"
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      data-selected={hour === selectedHour}
                      onClick={() => handleSelectHour(hour)}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium tabular-nums transition-colors",
                        hour === selectedHour
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {pad(hour)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Minute
                </p>
                <div
                  ref={minuteListRef}
                  className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1 custom-scrollbar"
                >
                  {minuteOptions.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      data-selected={minute === selectedMinute}
                      onClick={() => handleSelectMinute(minute)}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium tabular-nums transition-colors",
                        minute === selectedMinute
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {pad(minute)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
