import { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Categories for expected, user-facing rejections. Mirrors the client
 * `FailureCategory` in `src/lib/operationOutcome.ts`, which trusts this shape.
 */
export type AppErrorCategory =
  | "validation"
  | "authentication"
  | "permission"
  | "not_found"
  | "lifecycle"
  | "conflict"
  | "rate_limit"
  | "verification";

export type AppErrorData = {
  code: string;
  category: AppErrorCategory;
  /** Safe, user-facing text. Survives production redaction, unlike `Error`. */
  message: string;
  fieldErrors?: Record<string, string>;
  retryAfterMs?: number;
};

/**
 * Builds a typed application error for an expected rejection. Throw the
 * result: `throw appError("event_not_found", "not_found", "Event not found")`.
 * Unexpected failures should keep throwing plain `Error`s so they stay redacted.
 */
export function appError(
  code: string,
  category: AppErrorCategory,
  message: string,
  extra?: { fieldErrors?: Record<string, string>; retryAfterMs?: number },
): ConvexError<AppErrorData> {
  const data: AppErrorData = { code, category, message };
  // Convex values cannot hold `undefined`, so only copy fields that are set.
  if (extra?.fieldErrors) data.fieldErrors = extra.fieldErrors;
  if (typeof extra?.retryAfterMs === "number") data.retryAfterMs = extra.retryAfterMs;
  return new ConvexError(data);
}

/** Shared "event not found" rejection; also used when a hidden event is not visible. */
export function eventNotFound(): ConvexError<AppErrorData> {
  return appError("event_not_found", "not_found", "Event not found");
}

// Demo Day constants - exported for use in other modules
export const DEMO_DAY_CONSTANTS = {
  MAX_TAPS_PER_PROJECT_PER_ATTENDEE: 10,
  MAX_TAPS_PER_ATTENDEE: 100,
  IP_RATE_LIMIT_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  IP_RATE_LIMIT_MAX: 100, // Max appreciations from same IP in window
} as const;

export const JUDGE_CODE_MAX_FAILED_ATTEMPTS = 5;
export const JUDGE_CODE_LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Check if the current user is a global admin
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;

  const user = await ctx.db.get(userId as Id<"users">);
  return user?.isAdmin === true;
}

/**
 * Get the current user ID or throw an error
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw appError("not_authenticated", "authentication", "Not authenticated");
  return userId as Id<"users">;
}

/**
 * Require that the current user is an admin or throw an error
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await requireAuth(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !("isAdmin" in user) || !user.isAdmin) {
    throw appError(
      "admin_required",
      "permission",
      "Not authorized - admin access required",
    );
  }
  return userId;
}

export async function canAccessEvent(
  ctx: QueryCtx | MutationCtx,
  event: { hidden?: boolean } | null,
): Promise<boolean> {
  if (!event) return false;
  if (!event.hidden) return true;
  return await isAdmin(ctx);
}

/**
 * Anyone signed in can register a judge row, so the shared event code is the
 * only gate on scoring. Events without a code accept no judges at all.
 */
export function isJudgeVerifiedForEvent(
  event: { judgeCode?: string },
  judge: { judgeCodeVerifiedAt?: number; judgeCodeLockedUntil?: number },
): boolean {
  return (
    !!normalizeJudgeCode(event.judgeCode) &&
    typeof judge.judgeCodeVerifiedAt === "number" &&
    !isJudgeCodeLocked(judge)
  );
}

export const JUDGE_CODE_MIN_LENGTH = 6;
export const JUDGE_CODE_MAX_LENGTH = 32;
const JUDGE_CODE_PATTERN = /^[A-Z0-9-]+$/;

/** Judges type codes in uppercase, so codes compare case-insensitively. */
export function normalizeJudgeCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

export function judgeCodesMatch(expected: string | undefined, provided: string): boolean {
  const normalizedExpected = normalizeJudgeCode(expected);
  return normalizedExpected.length > 0 && normalizedExpected === normalizeJudgeCode(provided);
}

/**
 * Normalizes an admin-entered code. An empty code is allowed and closes
 * judging; any other code must be long enough to resist guessing.
 */
export function parseJudgeCodeSetting(code: string | null | undefined): string {
  const normalized = normalizeJudgeCode(code);
  if (!normalized) return "";
  if (
    normalized.length < JUDGE_CODE_MIN_LENGTH ||
    normalized.length > JUDGE_CODE_MAX_LENGTH ||
    !JUDGE_CODE_PATTERN.test(normalized)
  ) {
    throw appError(
      "invalid_judge_code_format",
      "validation",
      `Judge codes must be ${JUDGE_CODE_MIN_LENGTH}–${JUDGE_CODE_MAX_LENGTH} letters, numbers, or hyphens`,
      { fieldErrors: { judgeCode: `Use ${JUDGE_CODE_MIN_LENGTH}–${JUDGE_CODE_MAX_LENGTH} letters, numbers, or hyphens` } },
    );
  }
  return normalized;
}

export function isJudgeCodeLocked(
  judge: { judgeCodeLockedUntil?: number },
  now = Date.now(),
): boolean {
  return typeof judge.judgeCodeLockedUntil === "number" && judge.judgeCodeLockedUntil > now;
}

export function getJudgeCodeFailureState(
  judge: { judgeCodeFailedAttempts?: number; judgeCodeLockedUntil?: number },
  now = Date.now(),
) {
  const previousAttempts =
    judge.judgeCodeLockedUntil !== undefined &&
    judge.judgeCodeLockedUntil <= now
      ? 0
      : judge.judgeCodeFailedAttempts ?? 0;
  const failedAttempts = previousAttempts + 1;
  if (failedAttempts >= JUDGE_CODE_MAX_FAILED_ATTEMPTS) {
    return {
      judgeCodeFailedAttempts: failedAttempts,
      judgeCodeLockedUntil: now + JUDGE_CODE_LOCKOUT_MS,
    };
  }
  return {
    judgeCodeFailedAttempts: failedAttempts,
    judgeCodeLockedUntil:
      judge.judgeCodeLockedUntil !== undefined &&
      judge.judgeCodeLockedUntil <= now
        ? undefined
        : judge.judgeCodeLockedUntil,
  };
}

export function shouldInvalidateJudgeCodeState(
  currentCode: string | undefined,
  nextCode: string,
): boolean {
  return normalizeJudgeCode(currentCode) !== normalizeJudgeCode(nextCode);
}

export function stripJudgeCode<T extends { judgeCode?: unknown }>(
  event: T,
): Omit<T, "judgeCode"> {
  const { judgeCode: _judgeCode, ...publicEvent } = event;
  return publicEvent;
}

export function shapeTeamForPublic(team: any) {
  return {
    _id: team._id,
    eventId: team.eventId,
    name: team.name,
    description: team.description,
    members: team.members,
    githubUrl: team.githubUrl,
    projectUrl: team.projectUrl,
    devpostUrl: team.devpostUrl,
    track: team.track,
    courseCode: team.courseCode,
  };
}

/** Escape a participant-controlled value for safe CSV export. */
export function escapeCsvCell(value: string): string {
  const formulaSafe = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

/** Return only fields needed by the public event/team views. */
export function shapeEventForViewer(
  event: any,
  teams: any[] | undefined,
  viewerIsAdmin: boolean,
) {
  if (viewerIsAdmin) {
    return teams === undefined ? event : { ...event, teams };
  }

  const publicEvent: Record<string, any> = {
    _id: event._id,
    name: event.name,
    description: event.description,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    categories: event.categories,
    tracks: event.tracks,
    enableCohorts: event.enableCohorts,
    resultsReleased: event.resultsReleased,
    mode: event.mode,
    courseCodes: event.courseCodes,
    appreciationBudgetPerAttendee: event.appreciationBudgetPerAttendee,
    appreciationMaxPerTeam: event.appreciationMaxPerTeam,
    captchaEnabled: event.captchaEnabled,
    venueLocationEnabled: event.venueLocationEnabled,
    scoringLockedAt: event.scoringLockedAt,
    scoringLockReason: event.scoringLockReason,
    codeAndTellMaxBallots: event.codeAndTellMaxBallots,
    codeAndTellPhase: event.codeAndTellPhase,
  };

  if (event.resultsReleased) {
    publicEvent.overallWinner = event.overallWinner;
    publicEvent.categoryWinners = event.categoryWinners;
  }

  if (teams !== undefined) {
    publicEvent.teams = teams
      .filter((team) => !team.hidden)
      .map(shapeTeamForPublic);
  }

  return publicEvent;
}

/**
 * Compute event status based on current time and start/end dates
 * - If now < startDate → "upcoming"
 * - If startDate <= now <= endDate → "active"
 * - If now > endDate → "past"
 */
export function computeEventStatus(event: {
  startDate: number;
  endDate: number;
  mode?: string;
  codeAndTellPhase?: string;
}): "upcoming" | "active" | "past" {
  if (event.mode === "code_and_tell" && event.codeAndTellPhase) {
    return event.codeAndTellPhase === "closed" ? "past" : event.codeAndTellPhase === "submissions" ? "upcoming" : "active";
  }
  const now = Date.now();

  if (now < event.startDate) {
    return "upcoming";
  } else if (now > event.endDate) {
    return "past";
  } else {
    return "active";
  }
}
