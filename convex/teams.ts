import { v } from "convex/values";
import {
  getEffectivePrizeSubmissions,
  isAutomaticPrize,
  isPrizeEligibleForTrack,
} from "../shared/prizeEntries";
import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  appError,
  canAccessEvent,
  computeEventStatus,
  eventNotFound,
  isAdmin,
  requireAdmin,
  shapeTeamForPublic,
  requireAuth,
} from "./helpers";
import {
  getEventMode,
  isCodeAndTellMode,
  isDemoDayMode,
  isHackathonMode,
} from "./eventModes";
import { EMAIL_PATTERN, normalizeEmailList, normalizeOptionalString } from "./normalize";
import { EVENT_MODE_VALIDATOR } from "./validators";

function normalizeEntrantEmails(values?: string[]) {
  if (!values) return undefined;
  const deduped = normalizeEmailList(values);
  return deduped.length > 0 ? deduped : undefined;
}

function validateEntrantEmails(values?: string[]) {
  const entrantEmails = normalizeEntrantEmails(values);
  if (!entrantEmails) return undefined;

  for (const email of entrantEmails) {
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error(`Invalid entrant email: ${email}`);
    }
  }

  return entrantEmails;
}

function validateProjectUrl(projectUrl: string | undefined) {
  const normalized = normalizeOptionalString(projectUrl);
  if (!normalized) return undefined;
  if (!normalized.startsWith("https://")) {
    throw new Error("Project URL must start with https://");
  }
  return normalized;
}

function validateGithubUrl(githubUrl: string | undefined) {
  const normalized = normalizeOptionalString(githubUrl);
  if (!normalized) return undefined;
  if (!normalized.startsWith("https://github.com/")) {
    throw appError("invalid_github_url", "validation", "GitHub URL must start with https://github.com/");
  }
  return normalized;
}

function buildProjectUrlFields(
  projectUrl: string | undefined,
  githubUrl?: string,
) {
  const normalizedProjectUrl = normalizeOptionalString(projectUrl) || "";
  const normalizedGithubUrl =
    normalizeOptionalString(githubUrl) ||
    (normalizedProjectUrl.startsWith("https://github.com/")
      ? normalizedProjectUrl
      : "");
  return {
    projectUrl: normalizedProjectUrl,
    githubUrl: normalizedGithubUrl,
  };
}

export function shapeTeamsForViewer(
  teams: any[],
  viewerIsAdmin: boolean,
  includeHidden = false,
) {
  const visibleTeams = includeHidden && viewerIsAdmin
    ? teams
    : teams.filter((team) => !team.hidden);
  return viewerIsAdmin ? visibleTeams : visibleTeams.map(shapeTeamForPublic);
}

export function assertEditableTeamEvent(
  event: {
    startDate: number;
    endDate: number;
    mode?: string;
    scoringLockedAt?: number;
    resultsReleased?: boolean;
  },
  hidden: boolean | undefined,
) {
  if (computeEventStatus(event) !== "active") {
    throw appError("team_edits_closed", "lifecycle", "Team edits are only available while the event is active");
  }
  // Judges scored what they saw; edits after the lock would change it.
  if (event.scoringLockedAt || event.resultsReleased) {
    throw appError("team_edits_locked", "lifecycle", "Project edits are closed because scoring is locked");
  }
  if (hidden) {
    throw appError("team_hidden", "lifecycle", "Hidden teams cannot be edited");
  }
  if (isCodeAndTellMode(event.mode)) {
    throw appError("code_and_tell_entrant_edit", "permission", "Entrants cannot edit Code & Tell projects");
  }
}

export const createTeam = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    description: v.string(),
    members: v.array(v.string()),
    projectUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    devpostUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    entrantEmails: v.optional(v.array(v.string())),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    // Get event to validate course code if provided
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const mode = getEventMode(event.mode);
    const entrantEmails = validateEntrantEmails(args.entrantEmails);

    // Validate mode-specific fields.
    if (isDemoDayMode(mode) && args.courseCode) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    }

    if (isHackathonMode(mode)) {
      if (!args.track) {
        throw new Error("Track is required");
      }
      const availableTracks =
        event.tracks ||
        event.categories.map((c: any) => (typeof c === "string" ? c : c.name));
      if (!availableTracks.includes(args.track)) {
        throw new Error("Invalid track");
      }
    }

    if (isCodeAndTellMode(mode) && (!entrantEmails || entrantEmails.length === 0)) {
      throw new Error("At least one entrant email is required");
    }

    const projectUrl = validateProjectUrl(args.projectUrl);
    const githubUrl = validateGithubUrl(args.githubUrl);

    // Admin team creation - need to provide required new fields with defaults
    return await ctx.db.insert("teams", {
      eventId: args.eventId,
      name: args.name,
      description: args.description,
      members: args.members,
      ...buildProjectUrlFields(projectUrl, githubUrl),
      devpostUrl: args.devpostUrl || "",
      track: isHackathonMode(mode) ? args.track || "" : "",
      courseCode: isDemoDayMode(mode) ? args.courseCode : undefined,
      entrantEmails,
      logoStorageId: args.logoStorageId,
      submittedBy: userId,
      submittedAt: Date.now(),
    });
  },
});

export const updateTeamAdmin = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    description: v.string(),
    members: v.array(v.string()),
    projectUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    devpostUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    entrantEmails: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const event = await ctx.db.get(team.eventId);
    if (!event) throw new Error("Event not found");

    const mode = getEventMode(event.mode);
    const entrantEmails = validateEntrantEmails(args.entrantEmails);

    // Validate mode-specific fields.
    if (isDemoDayMode(mode) && args.courseCode) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    }

    if (isHackathonMode(mode)) {
      if (!args.track) {
        throw new Error("Track is required");
      }
      const availableTracks =
        event.tracks ||
        event.categories.map((c: any) => (typeof c === "string" ? c : c.name));
      if (!availableTracks.includes(args.track)) {
        throw new Error("Invalid track");
      }
    }

    if (isCodeAndTellMode(mode) && (!entrantEmails || entrantEmails.length === 0)) {
      throw new Error("At least one entrant email is required");
    }

    const projectUrl = validateProjectUrl(args.projectUrl);
    const githubUrl = validateGithubUrl(args.githubUrl);

    if (args.devpostUrl && !args.devpostUrl.startsWith("https://")) {
      throw new Error("Devpost URL must start with https://");
    }

    await ctx.db.patch(args.teamId, {
      name: args.name,
      description: args.description,
      members: args.members,
      ...buildProjectUrlFields(projectUrl, githubUrl),
      ...(args.devpostUrl !== undefined
        ? { devpostUrl: args.devpostUrl || "" }
        : {}),
      ...(isDemoDayMode(mode)
        ? { courseCode: args.courseCode, track: "" }
        : isHackathonMode(mode)
          ? { track: args.track || "", courseCode: undefined }
          : { track: "", courseCode: undefined }),
      entrantEmails,
    });

    return null;
  },
});

type SubmitTeamArgs = {
  eventId: Id<"events">;
  name: string;
  description: string;
  members: string[];
  githubUrl?: string;
  devpostUrl?: string;
  track?: string;
  courseCode?: string;
  logoStorageId?: Id<"_storage">;
};

async function insertSubmittedTeam(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: SubmitTeamArgs,
): Promise<Id<"teams">> {
  {
    // Verify event is active (computed from dates)
    const event = await ctx.db.get(args.eventId);
    if (!event) throw eventNotFound();
    if (!(await canAccessEvent(ctx, event))) throw eventNotFound();
    if (isCodeAndTellMode(event.mode)) {
      throw appError("code_and_tell_submission_admin_only", "permission", "Project submission is admin-only for Code & Tell events");
    }

    const status = computeEventStatus(event);
    if (status !== "active") {
      throw appError("submissions_closed", "lifecycle", "Can only submit teams to active events");
    }

    const isDemoDay = isDemoDayMode(event.mode);

    // Verify not a judge
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (judge) throw appError("judge_cannot_submit", "permission", "Judges cannot submit teams");

    // Check if already submitted a team
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_event_and_submitter", (q) =>
        q.eq("eventId", args.eventId).eq("submittedBy", userId)
      )
      .first();

    if (existing) throw appError("team_already_submitted", "conflict", "You have already submitted a team");

    // Check for duplicate team name in this event (excluding hidden teams)
    const allTeams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const visibleTeams = allTeams.filter((team) => !team.hidden);
    const duplicateName = visibleTeams.find(
      (team) => team.name.toLowerCase() === args.name.toLowerCase()
    );

    if (duplicateName) {
      throw appError("duplicate_team_name", "conflict", "A team with this name already exists for this event");
    }

    // Validate based on event mode
    if (isDemoDay) {
      // Validate course code for Demo Day
      if (!args.courseCode) {
        throw appError("course_code_required", "validation", "Course code is required for Demo Day events");
      }
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw appError("invalid_course_code", "validation", "Invalid course code");
      }
    } else {
      // Validate track for hackathon mode
      if (!args.track) {
        throw appError("track_required", "validation", "Track is required");
      }
      const availableTracks =
        event.tracks ||
        event.categories.map((c: any) => (typeof c === "string" ? c : c.name));
      if (!availableTracks.includes(args.track)) {
        throw appError("invalid_track", "validation", "Invalid track");
      }
    }

    // Validate GitHub URL - required for hackathon, optional for Demo Day
    if (!isDemoDay) {
      if (!args.githubUrl || !args.githubUrl.trim()) {
        throw appError("github_url_required", "validation", "GitHub URL is required");
      }
      if (!args.githubUrl.startsWith("https://github.com/")) {
        throw appError("invalid_github_url", "validation", "GitHub URL must start with https://github.com/");
      }
    } else if (
      args.githubUrl &&
      args.githubUrl.trim() &&
      !args.githubUrl.startsWith("https://github.com/")
    ) {
      // For Demo Day, only validate format if URL is provided
      throw appError("invalid_github_url", "validation", "GitHub URL must start with https://github.com/");
    }

    if (
      args.devpostUrl &&
      args.devpostUrl.trim() &&
      !args.devpostUrl.startsWith("https://")
    ) {
      throw appError("invalid_devpost_url", "validation", "Devpost URL must start with https://");
    }

    if (args.logoStorageId) {
      await assertAttachableLogo(ctx, args.logoStorageId, undefined);
    }

    // Register as participant if not already
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!participant) {
      await ctx.db.insert("participants", {
        userId,
        eventId: args.eventId,
        createdAt: Date.now(),
      });
    }

    return await ctx.db.insert("teams", {
      eventId: args.eventId,
      name: args.name,
      description: args.description,
      members: args.members,
      ...buildProjectUrlFields(args.githubUrl),
      devpostUrl: args.devpostUrl || "",
      track: args.track || "",
      courseCode: args.courseCode,
      logoStorageId: args.logoStorageId,
      submittedBy: userId,
      submittedAt: Date.now(),
    });
  }
}

export const getMyTeam = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(args.eventId);
    if (!(await canAccessEvent(ctx, event))) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_event_and_submitter", (q) =>
        q.eq("eventId", args.eventId).eq("submittedBy", userId)
      )
      .first();

    if (!team) return null;

    // Get logo URL if exists
    let logoUrl = null;
    if (team.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(team.logoStorageId);
    }

    // Explicit fields only: the raw document also holds live Demo Day tallies
    // and integrity flags, which must not reach entrants before release.
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
      hidden: team.hidden,
      submittedBy: team.submittedBy,
      submittedAt: team.submittedAt,
      logoUrl,
    };
  },
});

type UpdateTeamArgs = {
  teamId: Id<"teams">;
  description?: string;
  members?: string[];
  githubUrl?: string;
  devpostUrl?: string;
  track?: string;
  courseCode?: string;
  logoStorageId?: Id<"_storage">;
};

async function patchOwnTeam(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: UpdateTeamArgs,
): Promise<void> {
  {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw appError("team_not_found", "not_found", "Team not found");

    if (team.submittedBy !== userId) {
      throw appError("not_team_owner", "permission", "Not authorized");
    }

    const event = await ctx.db.get(team.eventId);
    if (!event) throw eventNotFound();
    if (!(await canAccessEvent(ctx, event))) throw eventNotFound();
    assertEditableTeamEvent(event, team.hidden);

    const isDemoDay = isDemoDayMode(event.mode);

    // Validate track if provided (hackathon mode)
    if (args.track && !isDemoDay) {
      const availableTracks =
        event.tracks ||
        event.categories.map((c: any) => (typeof c === "string" ? c : c.name));
      if (!availableTracks.includes(args.track)) {
        throw appError("invalid_track", "validation", "Invalid track");
      }
    }

    // Validate course code if provided (demo day mode)
    if (args.courseCode && isDemoDay) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw appError("invalid_course_code", "validation", "Invalid course code");
      }
    }

    // Validate GitHub URL if provided
    const githubUrl = validateGithubUrl(args.githubUrl);
    if (args.devpostUrl && !args.devpostUrl.startsWith("https://")) {
      throw appError("invalid_devpost_url", "validation", "Devpost URL must start with https://");
    }

    const updates: any = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.members !== undefined) updates.members = args.members;
    if (args.githubUrl !== undefined) {
      Object.assign(updates, buildProjectUrlFields(githubUrl));
    }
    if (args.devpostUrl !== undefined) updates.devpostUrl = args.devpostUrl;
    if (args.track !== undefined) updates.track = args.track;
    if (args.courseCode !== undefined) updates.courseCode = args.courseCode;
    const previousLogo = team.logoStorageId;
    if (args.logoStorageId !== undefined && args.logoStorageId !== previousLogo) {
      await assertAttachableLogo(ctx, args.logoStorageId, team._id);
      updates.logoStorageId = args.logoStorageId;
    }

    await ctx.db.patch(args.teamId, updates);
    if (updates.logoStorageId !== undefined && previousLogo) {
      await deleteLogoIfUnreferenced(ctx, previousLogo);
    }
  }
}

/**
 * Replaces the caller's opt-in prize entries for `team`. Mirrors
 * `prizes.setMyTeamPrizeSubmissions` but takes the already-written team so it
 * runs inside the same transaction as the project save.
 */
async function replaceOwnPrizeEntries(
  ctx: MutationCtx,
  userId: Id<"users">,
  team: Doc<"teams">,
  prizeIds: Id<"prizes">[],
) {
  const event = await ctx.db.get(team.eventId);
  if (!event) throw eventNotFound();
  if (!isHackathonMode(event.mode)) {
    throw appError("prizes_unsupported_mode", "validation", "Prize workflows are only supported for hackathon events");
  }
  if (computeEventStatus(event) === "past" || event.scoringLockedAt || event.resultsReleased) {
    throw appError("prize_selection_closed", "lifecycle", "Prize selection is closed for this event");
  }

  const uniquePrizeIds = Array.from(new Set(prizeIds));
  const eventPrizes = await ctx.db
    .query("prizes")
    .withIndex("by_event", (q) => q.eq("eventId", team.eventId))
    .collect();
  const eventPrizesById = new Map(eventPrizes.map((prize) => [prize._id, prize]));

  for (const prizeId of uniquePrizeIds) {
    const prize = eventPrizesById.get(prizeId);
    if (!prize) {
      throw appError("invalid_prize_selection", "validation", "One or more prize selections are invalid for this event");
    }
    if (!isPrizeEligibleForTrack(prize, team.track)) {
      throw appError("prize_not_eligible", "validation", `Your team is not eligible for the prize "${prize.name}"`);
    }
  }

  const existing = await ctx.db
    .query("teamPrizeSubmissions")
    .withIndex("by_event_and_team", (q) =>
      q.eq("eventId", team.eventId).eq("teamId", team._id)
    )
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete(row._id)));

  const now = Date.now();
  await Promise.all(
    uniquePrizeIds
      .filter((prizeId) => !isAutomaticPrize(eventPrizesById.get(prizeId)!))
      .map((prizeId) =>
        ctx.db.insert("teamPrizeSubmissions", {
          eventId: team.eventId,
          teamId: team._id,
          prizeId,
          submittedAt: now,
          submittedBy: userId,
        })
      )
  );
}

/**
 * Participant project save: creates or updates the caller's project and
 * replaces its prize entries in one transaction, so a failure leaves neither
 * step half-applied. A create retried after an uncertain outcome (same name,
 * project already recorded for this user) is applied as an update instead of
 * failing or creating a duplicate.
 */
const PROJECT_FIELD_LIMITS = {
  name: 120,
  description: 5000,
  members: 25,
  member: 120,
  url: 2048,
  label: 100,
} as const;

/**
 * Participant text reaches every visitor through public team lists, so cap it
 * well above real use but far below Convex's 1 MB document limit.
 */
export function assertProjectFieldLimits(args: {
  name?: string;
  description: string;
  members: string[];
  githubUrl?: string;
  devpostUrl?: string;
  track?: string;
  courseCode?: string;
}) {
  const tooLong = (value: string | undefined, max: number) =>
    value !== undefined && value.length > max;
  const fieldErrors: Record<string, string> = {};
  if (tooLong(args.name, PROJECT_FIELD_LIMITS.name)) {
    fieldErrors.name = `Use ${PROJECT_FIELD_LIMITS.name} characters or fewer`;
  }
  if (tooLong(args.description, PROJECT_FIELD_LIMITS.description)) {
    fieldErrors.description = `Use ${PROJECT_FIELD_LIMITS.description} characters or fewer`;
  }
  if (
    args.members.length > PROJECT_FIELD_LIMITS.members ||
    args.members.some((member) => tooLong(member, PROJECT_FIELD_LIMITS.member))
  ) {
    fieldErrors.members = `List up to ${PROJECT_FIELD_LIMITS.members} members, ${PROJECT_FIELD_LIMITS.member} characters each`;
  }
  if (tooLong(args.githubUrl, PROJECT_FIELD_LIMITS.url)) fieldErrors.githubUrl = "That link is too long";
  if (tooLong(args.devpostUrl, PROJECT_FIELD_LIMITS.url)) fieldErrors.devpostUrl = "That link is too long";
  if (tooLong(args.track, PROJECT_FIELD_LIMITS.label)) fieldErrors.track = "Invalid track";
  if (tooLong(args.courseCode, PROJECT_FIELD_LIMITS.label)) fieldErrors.courseCode = "Invalid course code";
  if (Object.keys(fieldErrors).length > 0) {
    throw appError("project_fields_too_long", "validation", "Some project details are too long", { fieldErrors });
  }
}

export const saveMyProject = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.optional(v.id("teams")),
    name: v.optional(v.string()),
    description: v.string(),
    members: v.array(v.string()),
    githubUrl: v.optional(v.string()),
    devpostUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    prizeIds: v.optional(v.array(v.id("prizes"))),
  },
  returns: v.object({ teamId: v.id("teams"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    assertProjectFieldLimits(args);

    let teamId = args.teamId;
    if (!teamId) {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_event_and_submitter", (q) =>
          q.eq("eventId", args.eventId).eq("submittedBy", userId)
        )
        .first();
      const name = args.name?.trim() ?? "";
      if (existing && name && existing.name.toLowerCase() === name.toLowerCase()) {
        teamId = existing._id;
      }
    }

    let created = false;
    if (teamId) {
      const team = await ctx.db.get(teamId);
      if (!team || team.eventId !== args.eventId) throw appError("team_not_found", "not_found", "Team not found");
      await patchOwnTeam(ctx, userId, {
        teamId,
        description: args.description,
        members: args.members,
        githubUrl: args.githubUrl,
        devpostUrl: args.devpostUrl,
        track: args.track,
        courseCode: args.courseCode,
        logoStorageId: args.logoStorageId,
      });
    } else {
      const name = args.name?.trim();
      if (!name) throw appError("team_name_required", "validation", "Team name is required");
      teamId = await insertSubmittedTeam(ctx, userId, {
        eventId: args.eventId,
        name,
        description: args.description,
        members: args.members,
        githubUrl: args.githubUrl,
        devpostUrl: args.devpostUrl,
        track: args.track,
        courseCode: args.courseCode,
        logoStorageId: args.logoStorageId,
      });
      created = true;
    }

    if (args.prizeIds !== undefined) {
      const savedTeam = await ctx.db.get(teamId);
      if (!savedTeam) throw appError("team_not_found", "not_found", "Team not found");
      await replaceOwnPrizeEntries(ctx, userId, savedTeam, args.prizeIds);
    }

    return { teamId, created };
  },
});

export const LOGO_UPLOAD_WINDOW_MS = 60 * 60 * 1000;
export const LOGO_UPLOADS_PER_WINDOW = 10;
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
/** SVG is excluded: it can carry script when opened from the storage URL. */
export const LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const generateUploadUrl = mutation({
  args: { eventId: v.id("events") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event || !(await canAccessEvent(ctx, event))) {
      throw eventNotFound();
    }
    if (computeEventStatus(event) !== "active") {
      throw appError("uploads_closed", "lifecycle", "Uploads are only available while the event is active");
    }
    if (isCodeAndTellMode(event.mode)) {
      throw appError("uploads_unsupported_mode", "permission", "Project uploads are not available for Code & Tell events");
    }
    if (event.scoringLockedAt) {
      throw appError("uploads_closed", "lifecycle", "Project edits are closed because scoring is locked");
    }
    // Judges cannot submit projects, so they have no reason to upload logos.
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();
    if (judge) {
      throw appError("judge_cannot_submit", "permission", "Judges cannot submit teams");
    }

    const now = Date.now();
    const windowStart = now - LOGO_UPLOAD_WINDOW_MS;
    const expired = await ctx.db
      .query("logoUploadIssuances")
      .withIndex("by_user_and_issued_at", (q) =>
        q.eq("userId", userId).lt("issuedAt", windowStart)
      )
      .take(LOGO_UPLOADS_PER_WINDOW);
    await Promise.all(expired.map((row) => ctx.db.delete(row._id)));

    const recent = await ctx.db
      .query("logoUploadIssuances")
      .withIndex("by_user_and_issued_at", (q) =>
        q.eq("userId", userId).gte("issuedAt", windowStart)
      )
      .take(LOGO_UPLOADS_PER_WINDOW);
    if (recent.length >= LOGO_UPLOADS_PER_WINDOW) {
      const oldest = Math.min(...recent.map((row) => row.issuedAt));
      throw appError(
        "logo_upload_rate_limited",
        "rate_limit",
        "Too many logo uploads. Try again later.",
        { retryAfterMs: Math.max(0, oldest + LOGO_UPLOAD_WINDOW_MS - now) },
      );
    }
    await ctx.db.insert("logoUploadIssuances", {
      userId,
      eventId: args.eventId,
      issuedAt: now,
    });

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Upload URLs accept any file, so check the stored file before a team may
 * reference it: it must still exist (the sweep removes old unattached
 * uploads), be a small raster image, and not already belong to another team.
 * Rejected files are left for the abandoned-upload sweep to delete.
 */
async function assertAttachableLogo(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  teamId: Id<"teams"> | undefined,
) {
  const file = await ctx.db.system.get(storageId);
  if (!file) {
    throw appError(
      "logo_upload_missing",
      "validation",
      "That logo upload has expired. Choose the image again.",
    );
  }
  if (!file.contentType || !LOGO_CONTENT_TYPES.has(file.contentType)) {
    throw appError("logo_invalid_type", "validation", "Logos must be PNG, JPEG, WebP, or GIF images");
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw appError("logo_too_large", "validation", "Logos must be 5 MB or smaller");
  }
  const owner = await ctx.db
    .query("teams")
    .withIndex("by_logo_storage", (q) => q.eq("logoStorageId", storageId))
    .first();
  if (owner && owner._id !== teamId) {
    throw appError("logo_in_use", "validation", "That logo upload belongs to another project");
  }
}

/** Deletes a replaced logo unless another team still references it. */
async function deleteLogoIfUnreferenced(ctx: MutationCtx, storageId: Id<"_storage">) {
  const stillUsed = await ctx.db
    .query("teams")
    .withIndex("by_logo_storage", (q) => q.eq("logoStorageId", storageId))
    .first();
  if (stillUsed) return;
  if (await ctx.db.system.get(storageId)) {
    await ctx.storage.delete(storageId);
  }
}

export const listTeams = query({
  args: {
    eventId: v.id("events"),
    includeHidden: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!(await canAccessEvent(ctx, event))) return [];
    const viewerIsAdmin = await isAdmin(ctx);

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return shapeTeamsForViewer(teams, viewerIsAdmin, args.includeHidden);
  },
});

export const hideTeam = mutation({
  args: {
    teamId: v.id("teams"),
    hidden: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    await ctx.db.patch(args.teamId, { hidden: args.hidden });
    return null;
  },
});

export const removeTeam = mutation({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    // Delete all scores for this team
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const score of scores) {
      await ctx.db.delete(score._id);
    }

    const rankedVotes = await ctx.db
      .query("rankedVotes")
      .withIndex("by_event", (q) => q.eq("eventId", team.eventId))
      .collect();

    for (const vote of rankedVotes) {
      if (!vote.rankedTeamIds.includes(args.teamId)) continue;

      const nextRankedTeamIds = vote.rankedTeamIds.filter(
        (teamId) => teamId !== args.teamId
      );

      if (nextRankedTeamIds.length === 0) {
        await ctx.db.delete(vote._id);
      } else {
        await ctx.db.patch(vote._id, {
          rankedTeamIds: nextRankedTeamIds,
          updatedAt: Date.now(),
        });
      }
    }

    // Delete the team
    await ctx.db.delete(args.teamId);

    const event = await ctx.db.get(team.eventId);
    if (event?.overallWinner === args.teamId) {
      await ctx.db.patch(team.eventId, {
        overallWinner: undefined,
        resultsReleased: false,
      });
    }
    return null;
  },
});

/**
 * Get a team's event ID by team ID.
 * Used for deep linking from QR codes.
 */
export const getTeamEventId = query({
  args: { teamId: v.id("teams") },
  returns: v.union(v.null(), v.id("events")),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    const event = await ctx.db.get(team.eventId);
    if (!(await canAccessEvent(ctx, event))) return null;
    if (team.hidden && !(await isAdmin(ctx))) return null;
    return team.eventId;
  },
});

/**
 * Get a team by ID with event info.
 * Used for the dedicated team page.
 */
export const getTeamById = query({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("teams"),
      eventId: v.id("events"),
      name: v.string(),
      description: v.string(),
      members: v.array(v.string()),
      githubUrl: v.optional(v.string()),
      projectUrl: v.optional(v.string()),
      track: v.optional(v.string()),
      courseCode: v.optional(v.string()),
      hidden: v.optional(v.boolean()),
      logoUrl: v.union(v.null(), v.string()),
      prizeEntries: v.array(v.object({
        _id: v.id("prizes"),
        name: v.string(),
        automatic: v.boolean(),
      })),
      event: v.object({
        _id: v.id("events"),
        name: v.string(),
        mode: v.optional(
          EVENT_MODE_VALIDATOR
        ),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    const event = await ctx.db.get(team.eventId);
    if (!event) return null;
    if (!(await canAccessEvent(ctx, event))) return null;
    if (team.hidden && !(await isAdmin(ctx))) return null;

    // Get logo URL if exists
    let logoUrl = null;
    if (team.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(team.logoStorageId);
    }

    // Public project metadata contains names and entry source, not submission actors.
    const [prizes, submissions] = isHackathonMode(event.mode)
      ? await Promise.all([
          ctx.db.query("prizes")
            .withIndex("by_event", (q) => q.eq("eventId", team.eventId)).collect(),
          ctx.db.query("teamPrizeSubmissions")
            .withIndex("by_event_and_team", (q) =>
              q.eq("eventId", team.eventId).eq("teamId", team._id),
            ).collect(),
        ])
      : [[], []];
    const entryIds = new Set(
      getEffectivePrizeSubmissions(prizes, [team], submissions)
        .map((entry) => entry.prizeId),
    );
    const prizeEntries = prizes
      .filter((prize) => entryIds.has(prize._id))
      .sort((a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
      )
      .map((prize) => ({
        _id: prize._id, name: prize.name, automatic: isAutomaticPrize(prize),
      }));

    return {
      _id: team._id,
      eventId: team.eventId,
      name: team.name,
      description: team.description,
      members: team.members,
      githubUrl: team.githubUrl,
      projectUrl: team.projectUrl,
      track: team.track,
      courseCode: team.courseCode,
      hidden: team.hidden,
      logoUrl,
      prizeEntries,
      event: {
        _id: event._id,
        name: event.name,
        mode: event.mode,
      },
    };
  },
});

/** Uploads younger than this may still be attached by a pending or retried save. */
export const LOGO_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;
/** Maximum files examined per sweep run; a full batch schedules a continuation. */
export const LOGO_SWEEP_BATCH_SIZE = 100;

/**
 * Deletes stored files that no team references once they are older than the
 * retention window: logos uploaded for a save that never completed, logos
 * replaced by a newer upload, and logos left behind by `removeTeam`.
 *
 * `teams.logoStorageId` is the only reference to `_storage` in the schema. If
 * another table starts storing file IDs, add its check here before deleting.
 *
 * Each run examines at most LOGO_SWEEP_BATCH_SIZE files in creation order.
 * Referenced files are skipped, so a full batch continues after the last file
 * examined rather than rescanning it. Re-running is safe: deleted files simply
 * no longer appear in the scan.
 */
export const sweepAbandonedLogoUploads = internalMutation({
  args: { afterCreationTime: v.optional(v.number()) },
  returns: v.object({
    scanned: v.number(),
    deleted: v.number(),
    continued: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ scanned: number; deleted: number; continued: boolean }> => {
    const cutoff = Date.now() - LOGO_UPLOAD_RETENTION_MS;
    const after = args.afterCreationTime;
    const files = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        after === undefined
          ? q.lt("_creationTime", cutoff)
          : q.gt("_creationTime", after).lt("_creationTime", cutoff),
      )
      .order("asc")
      .take(LOGO_SWEEP_BATCH_SIZE);

    let deleted = 0;
    for (const file of files) {
      const referencingTeam = await ctx.db
        .query("teams")
        .withIndex("by_logo_storage", (q) => q.eq("logoStorageId", file._id))
        .first();
      if (referencingTeam) continue;
      await ctx.storage.delete(file._id);
      deleted += 1;
    }

    const continued = files.length === LOGO_SWEEP_BATCH_SIZE;
    if (continued) {
      await ctx.scheduler.runAfter(0, internal.teams.sweepAbandonedLogoUploads, {
        afterCreationTime: files[files.length - 1]._creationTime,
      });
    }

    return { scanned: files.length, deleted, continued };
  },
});
