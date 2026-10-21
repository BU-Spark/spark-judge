/** Two-digit zero padding for clock and date parts; negatives clamp to 00. */
export function pad2(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function parseDateTimeInput(value: string) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

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

export function formatDateTimeInput(value: number | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function getAutoAdjustedEndDateTime(
  startValue: string,
  endValue: string,
  durationMinutes = 120
) {
  const startDate = parseDateTimeInput(startValue);

  if (!startDate) {
    return endValue;
  }

  const nextEnd = new Date(startDate);
  nextEnd.setMinutes(nextEnd.getMinutes() + durationMinutes);

  return formatDateTimeInput(nextEnd);
}
