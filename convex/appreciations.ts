import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import {
  canAccessEvent,
  computeEventStatus,
  DEMO_DAY_CONSTANTS,
  requireAdmin,
} from "./helpers";
import { isDemoDayMode } from "./eventModes";

// Constants for rate limiting
const {
  MAX_TAPS_PER_PROJECT_PER_ATTENDEE,
  MAX_TAPS_PER_ATTENDEE,
  IP_RATE_LIMIT_WINDOW_MS,
  IP_RATE_LIMIT_MAX,
} = DEMO_DAY_CONSTANTS;

function getEventLimits(event: any) {
  return {
    maxPerTeam:
      event?.appreciationMaxPerTeam ?? MAX_TAPS_PER_PROJECT_PER_ATTENDEE,
    maxPerAttendee:
      event?.appreciationBudgetPerAttendee ?? MAX_TAPS_PER_ATTENDEE,
  };
}

export function filterAppreciationsForVoter<T extends { voterUserId?: string }>(
  appreciations: T[],
  voterUserId: string,
): T[] {
  return appreciations.filter(
    (appreciation) => appreciation.voterUserId === voterUserId,
  );
}

export function getAppreciationVoterKey(appreciation: {
  voterUserId?: string;
  attendeeId: string;
}): string {
  return appreciation.voterUserId ?? `legacy:${appreciation.attendeeId}`;
}

/**
 * Get appreciation counts for all teams in a Demo Day event.
 * Returns total counts per team plus the attendee's own counts if attendeeId provided.
 */
export const getTeamAppreciations = query({
  args: {
    eventId: v.id("events"),
    attendeeId: v.optional(v.string()),
  },
  returns: v.object({
    teams: v.array(
      v.object({
        teamId: v.id("teams"),
        totalCount: v.number(),
        attendeeCount: v.number(),
      }),
    ),
    attendeeTotalCount: v.number(),
    attendeeRemainingBudget: v.number(),
    maxPerAttendee: v.number(),
    maxPerTeam: v.number(),
  }),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }
    if (!isDemoDayMode(event.mode)) {
      throw new Error("Appreciations are only available for Demo Day events");
    }
    const { maxPerTeam, maxPerAttendee } = getEventLimits(event);

    // Get all teams for this event
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Get all appreciations for this event
    const allAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const countableAppreciations = allAppreciations.filter(
      (appreciation) =>
        (appreciation.reviewStatus ?? "accepted") !== "rejected",
    );

    const voterUserId = await getAuthUserId(ctx);

    // Quota counts are keyed by the authenticated server identity. The
    // client attendeeId is intentionally ignored for authorization/counts.
    let attendeeAppreciations: typeof allAppreciations = [];
    if (voterUserId) {
      attendeeAppreciations = await ctx.db
        .query("appreciations")
        .withIndex("by_event_and_voter", (q) =>
          q.eq("eventId", args.eventId).eq("voterUserId", voterUserId),
        )
        .collect();
    }

    const totalByTeam = new Map<Id<"teams">, number>();
    for (const appreciation of countableAppreciations) {
      totalByTeam.set(
        appreciation.teamId,
        (totalByTeam.get(appreciation.teamId) ?? 0) + 1,
      );
    }

    const attendeeByTeam = new Map<Id<"teams">, number>();
    for (const appreciation of attendeeAppreciations) {
      attendeeByTeam.set(
        appreciation.teamId,
        (attendeeByTeam.get(appreciation.teamId) ?? 0) + 1,
      );
    }

    // Build team counts in O(teams + appreciations) time.
    const teamCounts = teams.filter((team) => !team.hidden).map((team) => {
      const totalCount = totalByTeam.get(team._id) ?? 0;
      const attendeeCount = attendeeByTeam.get(team._id) ?? 0;
      return {
        teamId: team._id,
        totalCount,
        attendeeCount,
      };
    });

    const attendeeTotalCount = attendeeAppreciations.length;
    const attendeeRemainingBudget = Math.max(
      0,
      maxPerAttendee - attendeeTotalCount,
    );

    return {
      teams: teamCounts,
      attendeeTotalCount,
      attendeeRemainingBudget,
      maxPerAttendee,
      maxPerTeam,
    };
  },
});

/**
 * Get appreciation data for a single team.
 * Used for the dedicated team page.
 */
export const getSingleTeamAppreciation = query({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
    attendeeId: v.optional(v.string()),
  },
  returns: v.object({
    totalCount: v.number(),
    attendeeCount: v.number(),
    attendeeTotalCount: v.number(),
    attendeeRemainingBudget: v.number(),
    maxPerAttendee: v.number(),
    maxPerTeam: v.number(),
  }),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }
    if (!isDemoDayMode(event.mode)) {
      throw new Error("Appreciations are only available for Demo Day events");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId || team.hidden) {
      throw new Error("Team not found");
    }
    const { maxPerTeam, maxPerAttendee } = getEventLimits(event);

    // Get all appreciations for this team
    const teamAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const totalCount = teamAppreciations.filter(
      (appreciation) =>
        (appreciation.reviewStatus ?? "accepted") !== "rejected",
    ).length;

    const voterUserId = await getAuthUserId(ctx);

    // Quota counts are keyed by the authenticated server identity.
    let attendeeCount = 0;
    let attendeeTotalCount = 0;
    if (voterUserId) {
      // Count for this specific team
      attendeeCount = filterAppreciationsForVoter(
        teamAppreciations,
        voterUserId,
      ).length;

      // Count total across all teams for budget calculation
      const allAttendeeAppreciations = await ctx.db
        .query("appreciations")
        .withIndex("by_event_and_voter", (q) =>
          q.eq("eventId", args.eventId).eq("voterUserId", voterUserId),
        )
        .collect();
      attendeeTotalCount = allAttendeeAppreciations.length;
    }

    const attendeeRemainingBudget = Math.max(
      0,
      maxPerAttendee - attendeeTotalCount,
    );

    return {
      totalCount,
      attendeeCount,
      attendeeTotalCount,
      attendeeRemainingBudget,
      maxPerAttendee,
      maxPerTeam,
    };
  },
});

/**
 * Get appreciation summary for admin dashboard.
 * Returns aggregated data for all teams with course codes.
 */
export const getEventAppreciationSummary = query({
  args: {
    eventId: v.id("events"),
  },
  returns: v.object({
    totalAppreciations: v.number(),
    cleanAppreciations: v.number(),
    uniqueAttendees: v.number(),
    appreciationBudgetPerAttendee: v.number(),
    appreciationMaxPerTeam: v.number(),
    teams: v.array(
      v.object({
        teamId: v.id("teams"),
        teamName: v.string(),
        courseCode: v.union(v.string(), v.null()),
        rawScore: v.number(),
        cleanScore: v.number(),
        flagged: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }

    // Get all teams for this event
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Get all appreciations for this event
    const allAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Count unique attendees
    const uniqueAttendees = new Set(allAppreciations.map(getAppreciationVoterKey))
      .size;
    const cleanAppreciations = allAppreciations.filter(
      (appreciation) =>
        (appreciation.reviewStatus ?? "accepted") !== "rejected",
    ).length;

    const countsByTeam = new Map<Id<"teams">, number>();
    for (const appreciation of allAppreciations) {
      countsByTeam.set(
        appreciation.teamId,
        (countsByTeam.get(appreciation.teamId) ?? 0) + 1,
      );
    }

    // Build team summary without repeated full-array scans.
    const teamSummary = teams.map((team) => {
      const teamCount = countsByTeam.get(team._id) ?? 0;
      return {
        teamId: team._id,
        teamName: team.name,
        courseCode: team.courseCode ?? null,
        rawScore: team.rawScore ?? teamCount,
        cleanScore: team.cleanScore ?? teamCount,
        flagged: team.flagged ?? false,
      };
    });

    // Sort by clean score so admin rankings reflect reviewed results.
    teamSummary.sort((a, b) => b.cleanScore - a.cleanScore);

    return {
      totalAppreciations: allAppreciations.length,
      cleanAppreciations,
      uniqueAttendees,
      appreciationBudgetPerAttendee:
        event.appreciationBudgetPerAttendee ?? MAX_TAPS_PER_ATTENDEE,
      appreciationMaxPerTeam:
        event.appreciationMaxPerTeam ?? MAX_TAPS_PER_PROJECT_PER_ATTENDEE,
      teams: teamSummary,
    };
  },
});

/**
 * Internal mutation to create an appreciation.
 * Called from HTTP endpoint which provides IP/UA metadata.
 */
export const createAppreciationInternal = internalMutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
    attendeeId: v.string(),
    voterUserId: v.id("users"),
    fingerprintKey: v.string(),
    ipAddress: v.string(),
    userAgent: v.string(),
    captchaPassId: v.optional(v.id("demoDayCaptchaPasses")),
    reviewStatus: v.optional(
      v.union(
        v.literal("accepted"),
        v.literal("flagged"),
        v.literal("rejected"),
      ),
    ),
    riskScore: v.optional(v.number()),
    riskReasons: v.optional(v.array(v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    appreciationId: v.optional(v.id("appreciations")),
    remainingForTeam: v.number(),
    remainingTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Verify event exists and is in demo_day mode
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return {
        success: false,
        error: "Event not found",
        remainingForTeam: 0,
        remainingTotal: 0,
      };
    }
    if (!isDemoDayMode(event.mode)) {
      return {
        success: false,
        error: "Event is not in Demo Day mode",
        remainingForTeam: 0,
        remainingTotal: 0,
      };
    }
    const { maxPerTeam, maxPerAttendee } = getEventLimits(event);

    // 2b. Enforce live status
    const status = computeEventStatus(event);
    if (status !== "active") {
      return {
        success: false,
        error: "Appreciations open once the event is live",
        remainingForTeam: 0,
        remainingTotal: 0,
      };
    }

    // 2. Verify team exists and belongs to this event
    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      return {
        success: false,
        error: "Team not found",
        remainingForTeam: 0,
        remainingTotal: 0,
      };
    }
    if (team.hidden) {
      return {
        success: false,
        error: "Team not found",
        remainingForTeam: 0,
        remainingTotal: 0,
      };
    }

    // 3. Check per-team limit using only the authenticated server identity.
    const attendeeTeamAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event_and_team_and_voter", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("teamId", args.teamId)
          .eq("voterUserId", args.voterUserId),
      )
      .collect();

    if (attendeeTeamAppreciations.length >= maxPerTeam) {
      return {
        success: false,
        error: `You've already given ${maxPerTeam} appreciations to this team`,
        remainingForTeam: 0,
        remainingTotal: Math.max(
          0,
          maxPerAttendee -
            (
              await ctx.db
                .query("appreciations")
                .withIndex("by_event_and_voter", (q) =>
                  q
                    .eq("eventId", args.eventId)
                    .eq("voterUserId", args.voterUserId),
                )
                .collect()
            ).length,
        ),
      };
    }

    // 4. Check total event budget
    const attendeeAllAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event_and_voter", (q) =>
        q.eq("eventId", args.eventId).eq("voterUserId", args.voterUserId),
      )
      .collect();

    if (attendeeAllAppreciations.length >= maxPerAttendee) {
      return {
        success: false,
        error: `You've used all ${maxPerAttendee} appreciations for this event`,
        remainingForTeam: maxPerTeam - attendeeTeamAppreciations.length,
        remainingTotal: 0,
      };
    }

    // 5. Soft IP rate limiting (100 per 10 minutes)
    const windowStart = now - IP_RATE_LIMIT_WINDOW_MS;
    const recentIpAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_ip_and_timestamp", (q) =>
        q.eq("ipAddress", args.ipAddress).gte("timestamp", windowStart),
      )
      .collect();

    if (recentIpAppreciations.length >= IP_RATE_LIMIT_MAX) {
      return {
        success: false,
        error: "Too many requests from this network. Please try again later.",
        remainingForTeam: maxPerTeam - attendeeTeamAppreciations.length,
        remainingTotal: maxPerAttendee - attendeeAllAppreciations.length,
      };
    }

    // 6. Insert the appreciation
    const appreciationId = await ctx.db.insert("appreciations", {
      eventId: args.eventId,
      teamId: args.teamId,
      attendeeId: args.attendeeId,
      voterUserId: args.voterUserId,
      fingerprintKey: args.fingerprintKey,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: now,
      captchaPassId: args.captchaPassId,
      reviewStatus: args.reviewStatus ?? "accepted",
      riskScore: args.riskScore,
      riskReasons: args.riskReasons,
    });

    // 7. Update denormalized score without a full recount query.
    const currentRawScore = team.rawScore ?? 0;
    const currentCleanScore = team.cleanScore ?? currentRawScore;
    const reviewStatus = args.reviewStatus ?? "accepted";
    await ctx.db.patch(args.teamId, {
      rawScore: currentRawScore + 1,
      cleanScore:
        reviewStatus === "rejected" ? currentCleanScore : currentCleanScore + 1,
      flagged: (team.flagged ?? false) || reviewStatus === "flagged",
    });

    return {
      success: true,
      appreciationId,
      remainingForTeam: maxPerTeam - attendeeTeamAppreciations.length - 1,
      remainingTotal: maxPerAttendee - attendeeAllAppreciations.length - 1,
    };
  },
});

/**
 * Get CSV export data for appreciations.
 * Returns data formatted for CSV download.
 */
export const getAppreciationsCsvData = query({
  args: {
    eventId: v.id("events"),
  },
  returns: v.array(
    v.object({
      teamId: v.string(),
      teamName: v.string(),
      courseCode: v.string(),
      totalAppreciations: v.number(),
      uniqueAttendees: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (!(await canAccessEvent(ctx, event))) {
      throw new Error("Event not found");
    }

    // Get all teams for this event
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Get all appreciations for this event
    const allAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const totalByTeam = new Map<Id<"teams">, number>();
    const uniqueAttendeesByTeam = new Map<Id<"teams">, Set<string>>();
    for (const appreciation of allAppreciations) {
      totalByTeam.set(
        appreciation.teamId,
        (totalByTeam.get(appreciation.teamId) ?? 0) + 1,
      );
      const attendees =
        uniqueAttendeesByTeam.get(appreciation.teamId) ?? new Set<string>();
      attendees.add(getAppreciationVoterKey(appreciation));
      uniqueAttendeesByTeam.set(appreciation.teamId, attendees);
    }

    // Build CSV data without repeated filtering.
    const csvData = teams.map((team) => {
      const totalAppreciations = totalByTeam.get(team._id) ?? 0;
      const uniqueAttendees = uniqueAttendeesByTeam.get(team._id)?.size ?? 0;

      return {
        teamId: team._id,
        teamName: team.name,
        courseCode: team.courseCode ?? "",
        totalAppreciations,
        uniqueAttendees,
      };
    });

    // Sort by total appreciations descending
    csvData.sort((a, b) => b.totalAppreciations - a.totalAppreciations);

    return csvData;
  },
});

/**
 * Clear all appreciations for a specific team.
 * Resets the team's denormalized scores to zero.
 */
export const clearTeamAppreciations = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const appreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    let deletedCount = 0;
    for (const appreciation of appreciations) {
      await ctx.db.delete(appreciation._id);
      deletedCount += 1;
    }

    await ctx.db.patch(args.teamId, {
      rawScore: 0,
      cleanScore: 0,
      flagged: false,
    });

    return { deletedCount };
  },
});

/**
 * Clear all appreciations for an entire event.
 * Resets denormalized scores for all teams in the event.
 */
export const clearEventAppreciations = mutation({
  args: {
    eventId: v.id("events"),
  },
  returns: v.object({
    deletedCount: v.number(),
    teamUpdates: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const appreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    let deletedCount = 0;
    for (const appreciation of appreciations) {
      await ctx.db.delete(appreciation._id);
      deletedCount += 1;
    }

    const [passes, findings] = await Promise.all([
      ctx.db
        .query("demoDayCaptchaPasses")
        .withIndex("by_event_and_ip", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("demoDayIntegrityFindings")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);
    for (const pass of passes) {
      await ctx.db.delete(pass._id);
    }
    for (const finding of findings) {
      await ctx.db.delete(finding._id);
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const team of teams) {
      await ctx.db.patch(team._id, {
        rawScore: 0,
        cleanScore: 0,
        flagged: false,
      });
    }

    return {
      deletedCount,
      teamUpdates: teams.length,
    };
  },
});
