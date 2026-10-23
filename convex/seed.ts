import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { deleteEventCascade } from "./events";
import { clearAllDataHandler } from "./seeds/admin/clearAllData";
import {
  makeCurrentUserAdminForAllEventsHandler,
  makeUserAdminByEmailHandler,
} from "./seeds/admin/adminAccess";
import { seedEventsHandler } from "./seeds/core/seedEvents";
import { seedSemesterHandler } from "./seeds/core/seedSemester";
import { seedLiveHackathonHandler } from "./seeds/core/seedLiveHackathon";
import { seedEverythingHandler } from "./seeds/core/seedEverything";
import { seedJudgeScoresHandler } from "./seeds/core/seedJudgeScores";
import { seedCohortJudgingDemoHandler } from "./seeds/demos/cohortJudging";
import { seedDemoDayEventHandler } from "./seeds/demos/demoDay";
import { seedRegularJudgingDemoHandler } from "./seeds/demos/regularJudging";
import { seedCodeAndTellDemoHandler } from "./seeds/demos/codeAndTell";
import {
  seedPrizeJudgingFlowDemoHandler,
  seedPrizeJudgingFlowLockedDemoHandler,
  seedPrizeJudgingFlowCohortsDemoHandler,
} from "./seeds/prize/prizeFlow";

export const seedEvents = internalMutation({
  args: {},
  handler: seedEventsHandler,
});

export const seedSemester = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    created: v.array(v.string()),
    skipped: v.array(v.string()),
  }),
  handler: seedSemesterHandler,
});

export const seedLiveHackathon = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgeCode: v.union(v.string(), v.null()),
  }),
  handler: seedLiveHackathonHandler,
});

export const seedJudgeScores = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    judgesCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedJudgeScoresHandler,
});

export const clearAllData = internalMutation({
  args: {},
  handler: clearAllDataHandler,
});

export const makeCurrentUserAdminForAllEvents = internalMutation({
  args: {},
  handler: makeCurrentUserAdminForAllEventsHandler,
});

export const makeUserAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    message: v.string(),
    userId: v.optional(v.id("users")),
  }),
  handler: makeUserAdminByEmailHandler,
});

export const seedEverything = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventsCreated: v.number(),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedEverythingHandler,
});

export const seedDemoDayEvent = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
  }),
  handler: seedDemoDayEventHandler,
});

export const seedCohortJudgingDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    assignmentsCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedCohortJudgingDemoHandler,
});

export const seedRegularJudgingDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedRegularJudgingDemoHandler,
});

export const seedPrizeJudgingFlowDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    prizesCreated: v.number(),
    submissionsCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedPrizeJudgingFlowDemoHandler,
});

export const seedPrizeJudgingFlowLockedDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    prizesCreated: v.number(),
    submissionsCreated: v.number(),
    scoresCreated: v.number(),
    winnersCreated: v.number(),
  }),
  handler: seedPrizeJudgingFlowLockedDemoHandler,
});

export const seedPrizeJudgingFlowCohortsDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
    judgesCreated: v.number(),
    prizesCreated: v.number(),
    submissionsCreated: v.number(),
    scoresCreated: v.number(),
    winnersCreated: v.number(),
  }),
  handler: seedPrizeJudgingFlowCohortsDemoHandler,
});

export const seedCodeAndTellDemo = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    withTeamsEventId: v.id("events"),
    emptyEventId: v.id("events"),
    teamsCreated: v.number(),
    ballotsInserted: v.number(),
  }),
  handler: seedCodeAndTellDemoHandler,
});

/**
 * Removes seeded test data: hidden events (with everything in them) and seed
 * users. Refuses visible events and real accounts so a mistyped ID can't
 * delete live data.
 */
export const removeSeedData = internalMutation({
  args: {
    eventIds: v.array(v.id("events")),
    userIds: v.array(v.id("users")),
  },
  returns: v.object({ eventsRemoved: v.number(), usersRemoved: v.number() }),
  handler: async (ctx, { eventIds, userIds }) => {
    for (const eventId of eventIds) {
      const event = await ctx.db.get(eventId);
      if (!event) throw new Error(`Event ${eventId} not found`);
      if (!event.hidden) {
        throw new Error(`Refusing to remove visible event "${event.name}"`);
      }
    }
    for (const userId of userIds) {
      const user = await ctx.db.get(userId);
      if (!user) throw new Error(`User ${userId} not found`);
      if (!user.email?.endsWith("@demo.example.com")) {
        throw new Error(`Refusing to remove non-seed user ${userId}`);
      }
    }
    for (const eventId of eventIds) await deleteEventCascade(ctx, eventId);
    for (const userId of userIds) await ctx.db.delete(userId);
    return { eventsRemoved: eventIds.length, usersRemoved: userIds.length };
  },
});
