import { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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
  if (!userId) throw new Error("Not authenticated");
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
    throw new Error("Not authorized - admin access required");
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
 * A judge row is not proof of access for code-protected events. Rows created
 * before verification remain pending until the user submits the event code.
 */
export function isJudgeVerifiedForEvent(
  event: { judgeCode?: string },
  judge: { judgeCodeVerifiedAt?: number; judgeCodeLockedUntil?: number },
): boolean {
  return (
    !event.judgeCode ||
    (typeof judge.judgeCodeVerifiedAt === "number" &&
      !isJudgeCodeLocked(judge))
  );
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
  return (currentCode ?? "") !== nextCode;
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
}): "upcoming" | "active" | "past" {
  const now = Date.now();

  if (now < event.startDate) {
    return "upcoming";
  } else if (now > event.endDate) {
    return "past";
  } else {
    return "active";
  }
}
