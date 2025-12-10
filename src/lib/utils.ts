import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: number | string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDateRange(
  startValue: number | string | Date,
  endValue: number | string | Date
): string {
  const startDate =
    startValue instanceof Date ? startValue : new Date(startValue);
  const endDate = endValue instanceof Date ? endValue : new Date(endValue);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Invalid date";
  }

  // Helper to format time - omit minutes if :00
  const formatTime = (date: Date) => {
    const minutes = date.getMinutes();
    if (minutes === 0) {
      return date.toLocaleString(undefined, { hour: "numeric" });
    }
    return date.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Helper to format date with time
  const formatDateWithTime = (date: Date) => {
    const dateStr = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
    });
    const timeStr = formatTime(date);
    return `${dateStr}, ${timeStr}`;
  };

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    // Same day: "Dec 8, 9 AM – 5 PM" or "Dec 8, 9:30 AM – 5 PM"
    const dateStr = startDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
    });
    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);
    return `${dateStr}, ${startTime} – ${endTime}`;
  } else {
    // Different days: "Dec 8, 9 AM – Dec 10, 5 PM"
    return `${formatDateWithTime(startDate)} – ${formatDateWithTime(endDate)}`;
  }
}
