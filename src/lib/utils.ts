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

export function formatDateRangeSimple(
  startValue: number | string | Date,
  endValue: number | string | Date
): string {
  const startDate =
    startValue instanceof Date ? startValue : new Date(startValue);
  const endDate = endValue instanceof Date ? endValue : new Date(endValue);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Invalid date";
  }

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: startDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
    });
  };

  if (sameDay) {
    return formatDate(startDate);
  } else {
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  }
}
