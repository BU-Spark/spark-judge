/**
 * Shared error and save-outcome contract for recoverable failures.
 *
 * A failure's category decides the recovery copy and whether retry is
 * offered. An outcome tracks what we actually know about a write: a network
 * error alone cannot say whether the server applied it, so it maps to
 * `unknown`, never `rejected`.
 */
import { ConvexError } from "convex/values";

export type FailureCategory =
  | "validation"
  | "authentication"
  | "permission"
  | "not_found"
  | "lifecycle"
  | "conflict"
  | "rate_limit"
  | "verification"
  | "network"
  | "storage"
  | "service"
  | "unexpected";

export type RecoverableFailure = {
  code: string;
  category: FailureCategory;
  operation: string;
  /** Safe, user-facing explanation. Never a stack trace or provider body. */
  message: string;
  fieldErrors?: Record<string, string>;
  retryAfterMs?: number;
  /** Short reference users can quote to support; also attached to the console report. */
  reference: string;
  /** Whether retrying the same request could succeed without user changes. */
  retryable: boolean;
};

export type OperationOutcome =
  | "idle"
  | "pending"
  | "confirmed"
  | "rejected"
  | "unknown"
  | "partial";

const RETRYABLE: ReadonlySet<FailureCategory> = new Set([
  "network",
  "service",
  "unexpected",
  "storage",
]);

const DEFAULT_COPY: Record<FailureCategory, string> = {
  validation: "Some details need correcting before this can be saved.",
  authentication: "Your sign-in has expired. Sign in again to continue; your changes are kept.",
  permission: "Your account doesn't have access to do this.",
  not_found: "This item is no longer available.",
  lifecycle: "This isn't available at the event's current stage.",
  conflict: "Someone else changed this. Review the latest version before saving.",
  rate_limit: "Too many attempts. Wait a moment before trying again.",
  verification: "Verification didn't complete. Try verifying again.",
  network: "The connection was interrupted. Your changes are kept; check your connection and retry.",
  storage: "This browser couldn't store a copy on this device.",
  service: "HackJudge couldn't complete this right now. Your changes are kept; try again shortly.",
  unexpected: "Something went wrong. Your changes are kept; try again.",
};

/** Short support reference shown to users and logged with the failure. */
export function makeReference(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const AUTH_PATTERN = /not (signed|logged) in|unauthenticated|not authenticated|sign in/i;
const PERMISSION_PATTERN = /not authori[sz]ed|permission|forbidden|admin access|only (organizers|admins)/i;
const NOT_FOUND_PATTERN = /not found|does not exist|no longer exists|deleted/i;
const LIFECYCLE_PATTERN = /locked|closed|not open|has ended|not started|not live|phase|already (submitted|published)/i;
const NETWORK_PATTERN = /network|failed to fetch|connection|timed? ?out|offline|load failed/i;
const VALIDATION_PATTERN = /required|invalid|must |too (long|short|many)|duplicate|already exists/i;

function categorize(message: string): FailureCategory {
  if (NETWORK_PATTERN.test(message)) return "network";
  if (AUTH_PATTERN.test(message)) return "authentication";
  if (PERMISSION_PATTERN.test(message)) return "permission";
  if (NOT_FOUND_PATTERN.test(message)) return "not_found";
  if (LIFECYCLE_PATTERN.test(message)) return "lifecycle";
  if (VALIDATION_PATTERN.test(message)) return "validation";
  return "unexpected";
}

/**
 * Convex wraps ordinary server errors as
 * "[CONVEX M(...)] [Request ID: ...] Server Error\nUncaught Error: <msg>\n at ...".
 * Extract only the application message; production deployments redact it.
 */
function extractServerMessage(raw: string): string | null {
  const uncaught = raw.match(/Uncaught (?:Convex)?Error:\s*([^\n]+)/);
  if (uncaught) return uncaught[1].trim();
  if (/^\[CONVEX/.test(raw) || /Server Error/.test(raw)) return null;
  const firstLine = raw.split("\n")[0]?.trim();
  return firstLine || null;
}

/**
 * Normalizes any thrown value into a safe, categorized failure.
 * `ConvexError` data of shape `{ code, category, message }` is trusted as-is.
 */
export function toRecoverableFailure(error: unknown, operation: string): RecoverableFailure {
  const reference = makeReference();

  if (error instanceof ConvexError) {
    const data = error.data as unknown;
    if (data && typeof data === "object") {
      const shaped = data as Partial<RecoverableFailure>;
      const category = shaped.category ?? categorize(String(shaped.message ?? ""));
      return {
        code: shaped.code ?? category,
        category,
        operation,
        message: shaped.message ?? DEFAULT_COPY[category],
        fieldErrors: shaped.fieldErrors,
        retryAfterMs: shaped.retryAfterMs,
        reference,
        retryable: RETRYABLE.has(category),
      };
    }
    if (typeof data === "string") {
      const category = categorize(data);
      return { code: category, category, operation, message: data, reference, retryable: RETRYABLE.has(category) };
    }
  }

  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const serverMessage = raw ? extractServerMessage(raw) : null;
  const category = serverMessage ? categorize(serverMessage) : raw && NETWORK_PATTERN.test(raw) ? "network" : "unexpected";
  // Only surface the server's text for expected domain rejections; otherwise use safe copy.
  const message =
    serverMessage && category !== "unexpected" && category !== "network" ? serverMessage : DEFAULT_COPY[category];

  reportFailure(operation, reference, error);

  return { code: category, category, operation, message, reference, retryable: RETRYABLE.has(category) };
}

/**
 * The outcome a caught mutation/action error implies. Network-category errors
 * mean we don't know whether the write happened.
 */
export function outcomeForFailure(failure: RecoverableFailure): Extract<OperationOutcome, "rejected" | "unknown"> {
  return failure.category === "network" ? "unknown" : "rejected";
}

/**
 * Central diagnostics hook. Logs operation, reference, and route only — never
 * form contents. Replace the console sink with a real reporter when one exists.
 */
export function reportFailure(operation: string, reference: string, error: unknown): void {
  const route = typeof window !== "undefined" ? window.location.pathname : "";
  console.error(`[hackjudge] ${operation} failed (ref ${reference}) on ${route}`, error);
}
