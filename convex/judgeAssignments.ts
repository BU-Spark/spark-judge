import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isHackathonMode } from "./eventModes";
import { canAccessEvent, isAdmin, isJudgeVerifiedForEvent, requireAuth } from "./helpers";
import { getOwnTeamPredicate } from "./teamMembership";

export function assertCanRemoveTeamAssignment(hasSubmittedScore: boolean) {
  if (hasSubmittedScore) {
    throw new Error("Cannot remove a team after submitting scores");
  }
}

export const addTeamToAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
  },
  returns: v.id("judgeAssignments"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) throw new Error("Not a judge for this event");

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      throw new Error("Invalid team for this event");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }
    if (!isHackathonMode(event.mode)) {
      throw new Error("Judge assignments are only available for hackathon events");
    }
    if (!isJudgeVerifiedForEvent(event, judge)) {
      throw new Error("Judge code verification required");
    }
    if (event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }
    const isOwnTeam = await getOwnTeamPredicate(ctx, userId);
    if (isOwnTeam(team)) {
      throw new Error("You cannot judge a project you are part of");
    }

    // Check if assignment already exists
    const existing = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("judgeAssignments", {
      judgeId: judge._id,
      eventId: args.eventId,
      teamId: args.teamId,
      addedAt: Date.now(),
    });
  },
});

export const addMultipleTeamsToAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamIds: v.array(v.id("teams")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) throw new Error("Not a judge for this event");

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }
    if (!isHackathonMode(event.mode)) {
      throw new Error("Judge assignments are only available for hackathon events");
    }
    if (!isJudgeVerifiedForEvent(event, judge)) {
      throw new Error("Judge code verification required");
    }
    if (event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }

    // Get judge's existing assignments for this event to avoid duplicates
    const existingAssignments = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_event", (q) =>
        q.eq("judgeId", judge._id).eq("eventId", args.eventId)
      )
      .collect();

    const existingTeamIds = new Set(existingAssignments.map((a) => a.teamId));
    const isOwnTeam = await getOwnTeamPredicate(ctx, userId);
    let addedCount = 0;

    for (const teamId of args.teamIds) {
      if (existingTeamIds.has(teamId)) continue;

      // Verify team belongs to event
      const team = await ctx.db.get(teamId);
      if (!team || team.eventId !== args.eventId) continue;
      if (isOwnTeam(team)) continue;

      await ctx.db.insert("judgeAssignments", {
        judgeId: judge._id,
        eventId: args.eventId,
        teamId: team._id,
        addedAt: Date.now(),
      });
      existingTeamIds.add(teamId); // Update set in case of duplicates in array
      addedCount++;
    }

    return addedCount;
  },
});

export const removeTeamFromAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) throw new Error("Not a judge for this event");

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      throw new Error("Invalid team for this event");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }
    if (!isHackathonMode(event.mode)) {
      throw new Error("Judge assignments are only available for hackathon events");
    }
    if (!isJudgeVerifiedForEvent(event, judge)) {
      throw new Error("Judge code verification required");
    }
    if (event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }

    const assignment = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    const existingScore = await ctx.db
      .query("scores")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    assertCanRemoveTeamAssignment(Boolean(existingScore));

    if (assignment) {
      await ctx.db.delete(assignment._id);
    }

    return null;
  },
});

export const getMyAssignments = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.id("teams")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event || !isHackathonMode(event.mode)) return [];
    if (!(await canAccessEvent(ctx, event))) return [];

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) return [];
    if (!isJudgeVerifiedForEvent(event, judge)) return [];

    const assignments = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_event", (q) =>
        q.eq("judgeId", judge._id).eq("eventId", args.eventId)
      )
      .collect();

    return assignments.map((a) => a.teamId);
  },
});

function normalizeIdentity(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Teams whose member list names this judge. Members are free text, so this is
 * a prompt for an organizer to check, not proof of a conflict.
 */
export function findPossibleConflicts(
  judge: { userId: string; name?: string; email?: string },
  teams: Array<{
    _id: string;
    members: string[];
    entrantEmails?: string[];
    submittedBy?: string;
  }>,
) {
  const name = normalizeIdentity(judge.name);
  const email = normalizeIdentity(judge.email);
  return teams
    .filter((team) => {
      if (team.submittedBy && team.submittedBy === judge.userId) return true;
      const people = [...team.members, ...(team.entrantEmails ?? [])].map(
        normalizeIdentity,
      );
      return people.some(
        (person) =>
          person.length > 0 &&
          ((name.length > 2 && person === name) ||
            (email.length > 0 && person.includes(email))),
      );
    })
    .map((team) => team._id);
}

export const getJudgingProgress = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      requiresCode: v.boolean(),
      cohortsEnabled: v.boolean(),
      judges: v.array(
        v.object({
          judgeId: v.id("judges"),
          name: v.string(),
          email: v.optional(v.string()),
          isAdmin: v.boolean(),
          verified: v.boolean(),
          verifiedAt: v.optional(v.number()),
          claimedTeamIds: v.array(v.id("teams")),
          scoredTeamIds: v.array(v.id("teams")),
          lastScoredAt: v.optional(v.number()),
          possibleConflictTeamIds: v.array(v.id("teams")),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!(await isAdmin(ctx))) return null;
    const event = await ctx.db.get(args.eventId);
    if (!event || !isHackathonMode(event.mode)) return null;

    const [judges, assignments, scores, teams] = await Promise.all([
      ctx.db
        .query("judges")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("judgeAssignments")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("scores")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);

    const rows = [];
    for (const judge of judges) {
      const user = await ctx.db.get(judge.userId);
      const judgeScores = scores.filter((score) => score.judgeId === judge._id);
      const lastScoredAt = judgeScores.reduce<number | undefined>(
        (latest, score) =>
          latest === undefined || score.submittedAt > latest
            ? score.submittedAt
            : latest,
        undefined,
      );
      rows.push({
        judgeId: judge._id,
        name: user?.name || user?.email || "Unknown judge",
        email: user?.email,
        isAdmin: (user as { isAdmin?: boolean } | null)?.isAdmin === true,
        verified: isJudgeVerifiedForEvent(event, judge),
        verifiedAt: judge.judgeCodeVerifiedAt,
        claimedTeamIds: assignments
          .filter((assignment) => assignment.judgeId === judge._id)
          .map((assignment) => assignment.teamId),
        scoredTeamIds: judgeScores.map((score) => score.teamId),
        lastScoredAt,
        possibleConflictTeamIds: findPossibleConflicts(
          { userId: judge.userId, name: user?.name, email: user?.email },
          teams,
        ) as typeof teams[number]["_id"][],
      });
    }

    return {
      requiresCode: Boolean(event.judgeCode),
      cohortsEnabled: Boolean(event.enableCohorts),
      judges: rows,
    };
  },
});
