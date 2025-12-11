import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, computeEventStatus } from "./helpers";

export const createTeam = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    description: v.string(),
    members: v.array(v.string()),
    projectUrl: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    // Get event to validate course code if provided
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const isDemoDay = event.mode === "demo_day";

    // Validate course code for Demo Day
    if (isDemoDay && args.courseCode) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    }

    // Admin team creation - need to provide required new fields with defaults
    return await ctx.db.insert("teams", {
      eventId: args.eventId,
      name: args.name,
      description: args.description,
      members: args.members,
      githubUrl: args.projectUrl || "",
      track: "",
      courseCode: args.courseCode,
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
    courseCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const event = await ctx.db.get(team.eventId);
    if (!event) throw new Error("Event not found");

    const isDemoDay = event.mode === "demo_day";

    // Validate course code for Demo Day
    if (isDemoDay && args.courseCode) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    }

    // Basic GitHub URL validation for hackathon projects
    if (!isDemoDay && args.projectUrl) {
      if (!args.projectUrl.startsWith("https://github.com/")) {
        throw new Error("Project URL must start with https://github.com/");
      }
    }

    await ctx.db.patch(args.teamId, {
      name: args.name,
      description: args.description,
      members: args.members,
      githubUrl: args.projectUrl || "",
      ...(isDemoDay ? { courseCode: args.courseCode } : {}),
    });

    return null;
  },
});

export const submitTeam = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    description: v.string(),
    members: v.array(v.string()),
    githubUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify event is active (computed from dates)
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const status = computeEventStatus(event);
    if (status !== "active") {
      throw new Error("Can only submit teams to active events");
    }

    const isDemoDay = event.mode === "demo_day";

    // Verify not a judge
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (judge) throw new Error("Judges cannot submit teams");

    // Check if already submitted a team
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_event_and_submitter", (q) =>
        q.eq("eventId", args.eventId).eq("submittedBy", userId)
      )
      .first();

    if (existing) throw new Error("You have already submitted a team");

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
      throw new Error("A team with this name already exists for this event");
    }

    // Validate based on event mode
    if (isDemoDay) {
      // Validate course code for Demo Day
      if (!args.courseCode) {
        throw new Error("Course code is required for Demo Day events");
      }
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    } else {
      // Validate track for hackathon mode
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

    // Validate GitHub URL - required for hackathon, optional for Demo Day
    if (!isDemoDay) {
      if (!args.githubUrl || !args.githubUrl.trim()) {
        throw new Error("GitHub URL is required");
      }
      if (!args.githubUrl.startsWith("https://github.com/")) {
        throw new Error("GitHub URL must start with https://github.com/");
      }
    } else if (
      args.githubUrl &&
      args.githubUrl.trim() &&
      !args.githubUrl.startsWith("https://github.com/")
    ) {
      // For Demo Day, only validate format if URL is provided
      throw new Error("GitHub URL must start with https://github.com/");
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
      githubUrl: args.githubUrl || "",
      track: args.track || "",
      courseCode: args.courseCode,
      logoStorageId: args.logoStorageId,
      submittedBy: userId,
      submittedAt: Date.now(),
    });
  },
});

export const getMyTeam = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

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

    return { ...team, logoUrl };
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    description: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    githubUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    if (team.submittedBy !== userId) {
      throw new Error("Not authorized");
    }

    const event = await ctx.db.get(team.eventId);
    if (!event) throw new Error("Event not found");

    const isDemoDay = event.mode === "demo_day";

    // Validate track if provided (hackathon mode)
    if (args.track && !isDemoDay) {
      const availableTracks =
        event.tracks ||
        event.categories.map((c: any) => (typeof c === "string" ? c : c.name));
      if (!availableTracks.includes(args.track)) {
        throw new Error("Invalid track");
      }
    }

    // Validate course code if provided (demo day mode)
    if (args.courseCode && isDemoDay) {
      if (event.courseCodes && !event.courseCodes.includes(args.courseCode)) {
        throw new Error("Invalid course code");
      }
    }

    // Validate GitHub URL if provided
    if (args.githubUrl && !args.githubUrl.startsWith("https://github.com/")) {
      throw new Error("GitHub URL must start with https://github.com/");
    }

    const updates: any = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.members !== undefined) updates.members = args.members;
    if (args.githubUrl !== undefined) updates.githubUrl = args.githubUrl;
    if (args.track !== undefined) updates.track = args.track;
    if (args.courseCode !== undefined) updates.courseCode = args.courseCode;
    if (args.logoStorageId !== undefined)
      updates.logoStorageId = args.logoStorageId;

    await ctx.db.patch(args.teamId, updates);
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

export const listTeams = query({
  args: {
    eventId: v.id("events"),
    includeHidden: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Filter out hidden teams unless explicitly requested
    if (!args.includeHidden) {
      return teams.filter((team) => !team.hidden);
    }

    return teams;
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

    // Delete the team
    await ctx.db.delete(args.teamId);
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
      courseCode: v.optional(v.string()),
      hidden: v.optional(v.boolean()),
      logoUrl: v.union(v.null(), v.string()),
      event: v.object({
        _id: v.id("events"),
        name: v.string(),
        mode: v.optional(
          v.union(v.literal("hackathon"), v.literal("demo_day"))
        ),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    const event = await ctx.db.get(team.eventId);
    if (!event) return null;

    // Get logo URL if exists
    let logoUrl = null;
    if (team.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(team.logoStorageId);
    }

    return {
      _id: team._id,
      eventId: team.eventId,
      name: team.name,
      description: team.description,
      members: team.members,
      githubUrl: team.githubUrl,
      courseCode: team.courseCode,
      hidden: team.hidden,
      logoUrl,
      event: {
        _id: event._id,
        name: event.name,
        mode: event.mode,
      },
    };
  },
});
