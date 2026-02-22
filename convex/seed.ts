import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { clearAllDataHandler } from "./seeds/admin/clearAllData";
import {
  makeCurrentUserAdminForAllEventsHandler,
  makeUserAdminByEmailHandler,
} from "./seeds/admin/adminAccess";
import { seedEventsHandler } from "./seeds/core/seedEvents";
import { seedEverythingHandler } from "./seeds/core/seedEverything";
import { seedJudgeScoresHandler } from "./seeds/core/seedJudgeScores";
import { seedCohortJudgingDemoHandler } from "./seeds/demos/cohortJudging";
import { seedDemoDayEventHandler } from "./seeds/demos/demoDay";
import { seedRegularJudgingDemoHandler } from "./seeds/demos/regularJudging";
import {
  seedPrizeJudgingFlowDemoHandler,
  seedPrizeJudgingFlowLockedDemoHandler,
  seedPrizeJudgingFlowCohortsDemoHandler,
} from "./seeds/prize/prizeFlow";

export const seedEvents = mutation({
  args: {},
  handler: seedEventsHandler,
});

export const seedJudgeScores = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    judgesCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: seedJudgeScoresHandler,
});

export const clearAllData = mutation({
  args: {},
  handler: clearAllDataHandler,
});

export const makeCurrentUserAdminForAllEvents = mutation({
  args: {},
  handler: makeCurrentUserAdminForAllEventsHandler,
});

export const makeUserAdminByEmail = mutation({
  args: { email: v.string() },
  returns: v.object({
    message: v.string(),
    userId: v.optional(v.id("users")),
  }),
  handler: makeUserAdminByEmailHandler,
});

export const seedEverything = mutation({
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

export const seedDemoDayEvent = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventId: v.id("events"),
    teamsCreated: v.number(),
  }),
  handler: seedDemoDayEventHandler,
});

export const seedCohortJudgingDemo = mutation({
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

export const seedRegularJudgingDemo = mutation({
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

export const seedPrizeJudgingFlowDemo = mutation({
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

export const seedPrizeJudgingFlowLockedDemo = mutation({
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

export const seedPrizeJudgingFlowCohortsDemo = mutation({
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
