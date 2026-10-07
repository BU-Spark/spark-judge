import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Retain seeded examples for admin testing without advertising invented events. */
export const hideSeedExamples = internalMutation({
  args: {},
  handler: async (ctx) => {
    const examples = new Set([
      "Code & Tell: Fall Kickoff",
      "Code & Tell: AI Edition",
      "Demo Day — Fall 2026",
      "Demo Day — Spring 2027",
    ]);
    const events = await ctx.db.query("events").collect();
    const matches = events.filter((event) => examples.has(event.name));
    for (const event of matches) await ctx.db.patch(event._id, { hidden: true });
    return { hidden: matches.map((event) => event.name) };
  },
});

/** Operator-only, additive import. Repeat runs preserve IDs, ballots and organizer state. */
export const upsertEvent = internalMutation({
  args: {
    eventId: v.optional(v.id("events")),
    name: v.string(),
    description: v.string(),
    mode: v.union(v.literal("code_and_tell"), v.literal("hackathon")),
    startDate: v.number(),
    endDate: v.number(),
    codeAndTellPhase: v.optional(v.union(
      v.literal("submissions"), v.literal("presentations"),
      v.literal("voting"), v.literal("closed"),
    )),
    projects: v.optional(
      v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          members: v.array(v.string()),
          entrantEmails: v.array(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (args.endDate <= args.startDate)
      throw new Error("Event end must follow start");
    const candidates = await ctx.db.query("events").collect();
    const existing = args.eventId
      ? await ctx.db.get(args.eventId)
      : candidates.find(
          (event) =>
            event.name === args.name &&
            event.startDate === args.startDate &&
            event.mode === args.mode,
        );
    if (args.eventId && !existing) throw new Error("Event not found");
    if (existing && existing.mode !== args.mode)
      throw new Error("Event mode mismatch");
    const metadata = {
      name: args.name,
      description: args.description,
      mode: args.mode,
      startDate: args.startDate,
      endDate: args.endDate,
      ...(args.mode === "code_and_tell" && args.codeAndTellPhase
        ? { codeAndTellPhase: args.codeAndTellPhase }
        : {}),
      ...(args.mode === "hackathon"
        ? {
            status: (args.startDate > Date.now()
              ? "upcoming"
              : args.endDate < Date.now()
                ? "past"
                : "active") as "upcoming" | "past" | "active",
          }
        : {}),
    };
    const eventId = existing
      ? existing._id
      : await ctx.db.insert("events", {
          ...metadata,
          categories: [],
          tracks: [],
          status: "upcoming",
          resultsReleased: false,
          ...(args.mode === "code_and_tell"
            ? { codeAndTellPhase: args.codeAndTellPhase ?? (args.startDate > Date.now() ? "submissions" as const : "presentations" as const) }
            : {}),
        });
    if (existing) await ctx.db.patch(eventId, metadata);
    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    let created = 0,
      updated = 0;
    for (const project of args.projects ?? []) {
      const entrantEmails = [
        ...new Set(
          project.entrantEmails.map((email) => email.trim().toLowerCase()),
        ),
      ];
      if (
        entrantEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      )
        throw new Error("Invalid entrant email");
      const match = existingTeams.find(
        (team) =>
          team.name === project.name ||
          team.entrantEmails?.some((email) => entrantEmails.includes(email)),
      );
      const values = {
        name: project.name.trim(),
        description: project.description.trim(),
        members: project.members,
        entrantEmails,
      };
      if (match) {
        await ctx.db.patch(match._id, values);
        updated++;
      } else {
        await ctx.db.insert("teams", {
          ...values,
          eventId,
          submittedAt: Date.now(),
        });
        created++;
      }
    }
    return {
      eventId,
      eventCreated: !existing,
      projectsCreated: created,
      projectsUpdated: updated,
    };
  },
});
