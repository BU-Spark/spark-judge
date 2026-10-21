/**
 * Guarded, versioned local draft storage.
 *
 * Browser storage can be blocked, full, or hold data written by an older
 * build. None of those conditions may clear the in-memory work a user is
 * editing, so every operation returns an explicit result instead of throwing.
 * Callers show "Draft saved on this device" only after a `saved` result.
 */

const DRAFT_PREFIX = "hackjudge:draft:";
/** Drafts older than this are treated as missing and removed on read. */
export const DEFAULT_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type DraftEnvelope<T> = {
  schema: number;
  savedAt: number;
  data: T;
};

export type DraftReadResult<T> =
  | { status: "found"; data: T; savedAt: number }
  | { status: "missing" }
  /** Stored value could not be parsed or came from another schema. The raw text is kept for recovery. */
  | { status: "unreadable"; raw: string }
  | { status: "unavailable" };

export type DraftWriteResult =
  | { status: "saved"; savedAt: number }
  | { status: "unavailable" };

export type DraftRemoveResult = { status: "removed" } | { status: "unavailable" };

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Builds a draft key scoped to a workflow plus identifying parts such as
 * event and user, so drafts never leak across events or accounts.
 */
export function draftKey(workflow: string, ...scope: Array<string | null | undefined>): string {
  return `${DRAFT_PREFIX}${workflow}:${scope.map((part) => part ?? "-").join(":")}`;
}

export function readDraft<T>(
  key: string,
  schema: number,
  options: { ttlMs?: number; isValid?: (data: unknown) => data is T } = {},
): DraftReadResult<T> {
  const storage = getStorage();
  if (!storage) return { status: "unavailable" };

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "missing" };

  let envelope: DraftEnvelope<unknown>;
  try {
    envelope = JSON.parse(raw) as DraftEnvelope<unknown>;
  } catch {
    return { status: "unreadable", raw };
  }
  if (
    !envelope ||
    typeof envelope !== "object" ||
    envelope.schema !== schema ||
    typeof envelope.savedAt !== "number"
  ) {
    return { status: "unreadable", raw };
  }
  const ttlMs = options.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  if (Date.now() - envelope.savedAt > ttlMs) {
    removeDraft(key);
    return { status: "missing" };
  }
  if (options.isValid && !options.isValid(envelope.data)) {
    return { status: "unreadable", raw };
  }
  return { status: "found", data: envelope.data as T, savedAt: envelope.savedAt };
}

export function writeDraft<T>(key: string, schema: number, data: T): DraftWriteResult {
  const storage = getStorage();
  if (!storage) return { status: "unavailable" };
  const savedAt = Date.now();
  try {
    storage.setItem(key, JSON.stringify({ schema, savedAt, data } satisfies DraftEnvelope<T>));
    return { status: "saved", savedAt };
  } catch {
    return { status: "unavailable" };
  }
}

export function removeDraft(key: string): DraftRemoveResult {
  const storage = getStorage();
  if (!storage) return { status: "unavailable" };
  try {
    storage.removeItem(key);
    return { status: "removed" };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Moves an unreadable stored value aside so a fresh draft can be written
 * without destroying data someone may still want to recover.
 */
export function quarantineDraft(key: string, raw: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${key}:unreadable`, raw);
    storage.removeItem(key);
  } catch {
    // Leave the original in place; a later write will report its own status.
  }
}

/** Safe wrappers for non-draft preferences (theme etc.). Never throw. */
export function safeGetItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
