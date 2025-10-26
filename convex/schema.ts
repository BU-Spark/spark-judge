import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Extend auth tables to add isAdmin field to users
const customAuthTables = {
  ...authTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    isAdmin: v.optional(v.boolean()), // Global platform admin
  }).index("email", ["email"]),
};

const applicationTables = {
  events: defineTable({
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
        weight: v.number(), // 0-2 multiplier
      })
    ), // Awards/categories for judging
    tracks: v.optional(v.array(v.string())), // Tracks for team registration (optional, defaults to categories)
    enableCohorts: v.optional(v.boolean()), // Enable multiple judging cohorts (judges select their teams)
    resultsReleased: v.boolean(),
    judgeCode: v.optional(v.string()),
    overallWinner: v.optional(v.id("teams")),
    categoryWinners: v.optional(
      v.array(
        v.object({
          category: v.string(),
          teamId: v.id("teams"),
        })
      )
    ),
  }).index("by_status", ["status"]),

  teams: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    description: v.string(),
    members: v.array(v.string()),
    githubUrl: v.optional(v.string()),
    track: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    submittedBy: v.optional(v.id("users")),
    submittedAt: v.optional(v.number()),
    projectUrl: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
  })
    .index("by_event", ["eventId"])
    .index("by_submitter", ["submittedBy"])
    .index("by_event_and_submitter", ["eventId", "submittedBy"]),

  participants: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_event", ["eventId"])
    .index("by_user_and_event", ["userId", "eventId"]),

  judges: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
  })
    .index("by_user", ["userId"])
    .index("by_event", ["eventId"])
    .index("by_user_and_event", ["userId", "eventId"]),

  judgeAssignments: defineTable({
    judgeId: v.id("judges"),
    eventId: v.id("events"),
    teamId: v.id("teams"),
    addedAt: v.number(),
  })
    .index("by_judge", ["judgeId"])
    .index("by_event", ["eventId"])
    .index("by_judge_and_event", ["judgeId", "eventId"])
    .index("by_judge_and_team", ["judgeId", "teamId"]),

  scores: defineTable({
    judgeId: v.id("judges"),
    teamId: v.id("teams"),
    eventId: v.id("events"),
    categoryScores: v.array(
      v.object({
        category: v.string(),
        score: v.number(),
      })
    ),
    totalScore: v.number(),
    submittedAt: v.number(),
  })
    .index("by_judge_and_team", ["judgeId", "teamId"])
    .index("by_event", ["eventId"])
    .index("by_team", ["teamId"]),
};

export default defineSchema({
  ...customAuthTables,
  ...applicationTables,
});
