import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAdmin, requireAdmin, computeEventStatus } from "./helpers";
import { Id } from "./_generated/dataModel";

export const listEvents = query({
  args: {},
  returns: v.object({
    upcoming: v.array(v.any()),
    active: v.array(v.any()),
    past: v.array(v.any()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const userIsAdmin = await isAdmin(ctx);
    const events = await ctx.db.query("events").collect();

    let judgesByEventId = new Map<Id<"events">, Id<"judges">>();
    let participantEventIds = new Set<Id<"events">>();
    if (userId) {
      const [allMyJudgeRows, allMyParticipantRows] = await Promise.all([
        ctx.db
          .query("judges")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("participants")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);
      judgesByEventId = new Map(
        allMyJudgeRows.map((judge) => [judge.eventId, judge._id])
      );
      participantEventIds = new Set(
        allMyParticipantRows.map((participant) => participant.eventId)
      );
    }

    const eventsWithTeamCounts = await Promise.all(
      events.map(async (event) => {
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        // Compute status based on dates
        const status = computeEventStatus(event);

        // Check user's role for this event
        let userRole = null;
        let judgeProgress: {
          completedTeams: number;
          totalTeams: number;
        } | null = null;
        if (userId) {
          const judgeId = judgesByEventId.get(event._id);
          if (judgeId) {
            userRole = { role: "judge" as const, isAdmin: userIsAdmin };
            const judgeScores = await ctx.db
              .query("scores")
              .withIndex("by_event", (q) => q.eq("eventId", event._id))
              .filter((q) => q.eq(q.field("judgeId"), judgeId))
              .collect();
            judgeProgress = {
              completedTeams: judgeScores.length,
              totalTeams: teams.length,
            };
          } else if (participantEventIds.has(event._id)) {
            userRole = { role: "participant" as const };
          }
        }

        return {
          ...event,
          status, // Use computed status
          teamCount: teams.length,
          userRole,
          judgeProgress,
          requiresJudgeCode: status === "active" && !!event.judgeCode,
        };
      })
    );

    return {
      upcoming: eventsWithTeamCounts.filter((e) => e.status === "upcoming"),
      active: eventsWithTeamCounts.filter((e) => e.status === "active"),
      past: eventsWithTeamCounts.filter((e) => e.status === "past"),
    };
  },
});

export const getEvent = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Compute status based on dates
    const status = computeEventStatus(event);

    return { ...event, status, teams };
  },
});

export const joinAsJudge = mutation({
  args: { eventId: v.id("events") },
  returns: v.id("judges"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already a participant
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (participant) {
      throw new Error("You are already a participant for this event");
    }

    const existing = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("judges", {
      userId,
      eventId: args.eventId,
    });
  },
});

export const verifyJudgeCodeAndStartJudging = mutation({
  args: {
    eventId: v.id("events"),
    judgeCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    // Verify event is active (computed from dates)
    const status = computeEventStatus(event);
    if (status !== "active") {
      throw new Error("Event is not currently active");
    }

    // Verify user is a judge
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) {
      throw new Error("You are not registered as a judge for this event");
    }

    // Validate judge code
    if (event.judgeCode && event.judgeCode !== args.judgeCode) {
      throw new Error("Invalid judge code");
    }

    return true;
  },
});

export const getJudgeStatus = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    return judge;
  },
});

export const createEvent = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("past")
    ),
    startDate: v.number(),
    endDate: v.number(),
    categories: v.array(
      v.object({
        name: v.string(),
        weight: v.number(),
        optOutAllowed: v.optional(v.boolean()),
      })
    ),
    tracks: v.optional(v.array(v.string())),
    judgeCode: v.optional(v.string()),
    enableCohorts: v.optional(v.boolean()),
    mode: v.optional(v.union(v.literal("hackathon"), v.literal("demo_day"))),
    courseCodes: v.optional(v.array(v.string())),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.startDate >= args.endDate) {
      throw new Error("End date must be after start date");
    }

    const computedStatus = computeEventStatus({
      startDate: args.startDate,
      endDate: args.endDate,
    });

    const eventId = await ctx.db.insert("events", {
      ...args,
      status: computedStatus,
      resultsReleased: false,
    });

    return eventId;
  },
});

export const updateEventStatus = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("past")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const duration = event.endDate - event.startDate;

    // Update dates to achieve the desired status
    let updates: { startDate: number; endDate: number };

    switch (args.status) {
      case "upcoming":
        // Set event to start tomorrow, preserve duration
        updates = {
          startDate: now + day,
          endDate: now + day + duration,
        };
        break;
      case "active":
        // Set event to have started yesterday, end tomorrow (or preserve duration)
        updates = {
          startDate: now - day,
          endDate: Math.max(now + day, now - day + duration),
        };
        break;
      case "past":
        // Set event to have ended yesterday, preserve duration
        updates = {
          startDate: now - day - duration,
          endDate: now - day,
        };
        break;
    }

    await ctx.db.patch(args.eventId, updates);
    return null;
  },
});

export const removeEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const [scores, teams, judges, participants, prizes, prizeSubmissions, prizeWinners] =
      await Promise.all([
        ctx.db
          .query("scores")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("teams")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("judges")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("participants")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("prizes")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("teamPrizeSubmissions")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
        ctx.db
          .query("prizeWinners")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
      ]);

    await Promise.all(scores.map((score) => ctx.db.delete(score._id)));

    for (const team of teams) {
      if (team.logoStorageId) {
        await ctx.storage.delete(team.logoStorageId);
      }
      await ctx.db.delete(team._id);
    }

    await Promise.all(judges.map((judge) => ctx.db.delete(judge._id)));
    await Promise.all(
      participants.map((participant) => ctx.db.delete(participant._id))
    );
    await Promise.all(prizeSubmissions.map((submission) => ctx.db.delete(submission._id)));
    await Promise.all(prizeWinners.map((winner) => ctx.db.delete(winner._id)));
    await Promise.all(prizes.map((prize) => ctx.db.delete(prize._id)));

    await ctx.db.delete(eventId);
    return null;
  },
});

export const duplicateEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.id("events"),
  handler: async (ctx, { eventId }) => {
    const userId = await requireAdmin(ctx);

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const baseName = event.name.replace(/\s\(Copy(?: \d+)?\)$/, "");
    let copyIndex = 0;
    let newName = `${baseName} (Copy)`;

    const existingEvents = await ctx.db.query("events").collect();
    const nameSet = new Set(existingEvents.map((e) => e.name));

    while (nameSet.has(newName)) {
      copyIndex += 1;
      newName = `${baseName} (Copy ${copyIndex + 1})`;
    }

    const newEventId = await ctx.db.insert("events", {
      name: newName,
      description: event.description,
      status: "upcoming",
      startDate: event.startDate,
      endDate: event.endDate,
      categories: event.categories,
      tracks: event.tracks,
      resultsReleased: false,
      judgeCode: undefined,
      mode: event.mode,
      courseCodes: event.courseCodes,
      scoringLockedAt: undefined,
      scoringLockedBy: undefined,
      scoringLockReason: undefined,
    });

    if (event.mode !== "demo_day") {
      const eventPrizes = await ctx.db
        .query("prizes")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();

      const now = Date.now();
      await Promise.all(
        eventPrizes.map((prize) =>
          ctx.db.insert("prizes", {
            eventId: newEventId,
            name: prize.name,
            description: prize.description,
            type: prize.type,
            track: prize.track,
            sponsorName: prize.sponsorName,
            scoreBasis: prize.scoreBasis,
            scoreCategoryNames: prize.scoreCategoryNames,
            isActive: prize.isActive,
            sortOrder: prize.sortOrder,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
          })
        )
      );
    }

    return newEventId;
  },
});

export const updateEventCategories = mutation({
  args: {
    eventId: v.id("events"),
    categories: v.array(
      v.object({
        name: v.string(),
        weight: v.number(),
        optOutAllowed: v.optional(v.boolean()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.eventId, { categories: args.categories });
    return null;
  },
});

export const updateEventCohorts = mutation({
  args: {
    eventId: v.id("events"),
    enableCohorts: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.eventId, { enableCohorts: args.enableCohorts });
    return null;
  },
});

export const updateEventMode = mutation({
  args: {
    eventId: v.id("events"),
    mode: v.union(v.literal("hackathon"), v.literal("demo_day")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.eventId, { mode: args.mode });
    return null;
  },
});

export const updateEventDetails = mutation({
  args: {
    eventId: v.id("events"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    judgeCode: v.optional(v.union(v.string(), v.null())),
    appreciationBudgetPerAttendee: v.optional(v.number()),
    tracks: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const updates: {
      name?: string;
      description?: string;
      startDate?: number;
      endDate?: number;
      judgeCode?: string;
      appreciationBudgetPerAttendee?: number;
      tracks?: string[];
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.tracks !== undefined) updates.tracks = args.tracks;
    if (args.judgeCode !== undefined) {
      // Treat null as a request to clear the judge code.
      updates.judgeCode = args.judgeCode ?? "";
    }
    if (args.appreciationBudgetPerAttendee !== undefined) {
      updates.appreciationBudgetPerAttendee = Math.max(
        0,
        args.appreciationBudgetPerAttendee
      );
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.eventId, updates);
    }
    return null;
  },
});

export const setScoringLock = mutation({
  args: {
    eventId: v.id("events"),
    locked: v.boolean(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    if (event.mode === "demo_day") {
      throw new Error("Scoring lock is only available for hackathon events");
    }

    if (args.locked) {
      await ctx.db.patch(args.eventId, {
        scoringLockedAt: Date.now(),
        scoringLockedBy: adminId,
        scoringLockReason: args.reason?.trim() || undefined,
      });
    } else {
      await ctx.db.patch(args.eventId, {
        scoringLockedAt: undefined,
        scoringLockedBy: undefined,
        scoringLockReason: undefined,
      });
    }
    return null;
  },
});

export const isUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    return user?.isAdmin === true;
  },
});
