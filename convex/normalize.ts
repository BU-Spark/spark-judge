// Input normalization shared across Convex modules.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

/** Trimmed, lowercased, de-duplicated emails with blanks removed. */
export function normalizeEmailList(values: string[]) {
  return Array.from(
    new Set(values.map(normalizeEmail).filter((email): email is string => email !== null)),
  );
}
