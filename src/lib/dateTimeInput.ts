function pad(value: number) {
  return String(value).padStart(2, "0");
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

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
