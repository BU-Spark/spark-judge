import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const EVENT_MODE_VALIDATOR = v.union(
  v.literal("hackathon"),
  v.literal("demo_day"),
  v.literal("code_and_tell"),
);

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
      v.literal("past"),
    ),
    startDate: v.number(),
    endDate: v.number(),
    categories: v.array(
      v.object({
        name: v.string(),
        weight: v.number(), // Internal multiplier derived from rubric percentage
        optOutAllowed: v.optional(v.boolean()), // Judges can mark "not comfortable"
      }),
    ), // Awards/categories for judging
    // Demo Day appreciation limits (optional; defaults applied in logic)
    appreciationBudgetPerAttendee: v.optional(v.number()), // Total hearts an attendee can give
    appreciationMaxPerTeam: v.optional(v.number()), // Hearts an attendee can give a single team
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
        }),
      ),
    ),
    // Demo Day mode support
    mode: v.optional(EVENT_MODE_VALIDATOR), // undefined = "hackathon" for backwards compatibility
    courseCodes: v.optional(v.array(v.string())), // Available course codes for Demo Day mode
    // Hackathon scoring lock - when set, judges can no longer modify scores
    scoringLockedAt: v.optional(v.number()),
    scoringLockedBy: v.optional(v.id("users")),
    scoringLockReason: v.optional(v.string()),
    // Code & Tell: optional cap on distinct ballots (rankedVotes rows); unset = unlimited
    codeAndTellMaxBallots: v.optional(v.number()),
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
    devpostUrl: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    entrantEmails: v.optional(v.array(v.string())),
    // Demo Day appreciation scores (optional, can be computed from appreciations table)
    rawScore: v.optional(v.number()), // Total appreciations count
    cleanScore: v.optional(v.number()), // Cleaned/validated appreciation count
    flagged: v.optional(v.boolean()), // Flagged for suspicious activity
    courseCode: v.optional(v.string()), // Course code for Demo Day filtering (e.g., "DS519")
    // Demo Day board assignments
    demoDayRound: v.optional(v.number()), // Round number (e.g., 4, 5, 6)
    demoDayBoardNumber: v.optional(v.string()), // Board letter (e.g., "A", "B", "C")
    demoDayProjectInstance: v.optional(v.string()), // Stable source key from Airtable/CSV import
    airtableProjectRecordId: v.optional(v.string()), // Airtable project record ID for traceability
    airtableProjectInstanceRecordId: v.optional(v.string()), // Airtable project instance record ID for traceability
    demoDaySignName: v.optional(v.string()), // Short display name from board assignment sheet
    demoDayFullSignName: v.optional(v.string()), // Full printable sign label from board assignment sheet
    demoDayBoardTime: v.optional(v.string()), // Board display time slot
    demoDayCourseName: v.optional(v.string()), // Human-readable course name from board assignment sheet
  })
    .index("by_event", ["eventId"])
    .index("by_submitter", ["submittedBy"])
    .index("by_event_and_submitter", ["eventId", "submittedBy"])
    .index("by_event_and_project_instance", [
      "eventId",
      "demoDayProjectInstance",
    ]),

  rankedVotes: defineTable({
    eventId: v.id("events"),
    voterUserId: v.id("users"),
    rankedTeamIds: v.array(v.id("teams")),
    submittedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_voter", ["voterUserId"])
    .index("by_event_and_voter", ["eventId", "voterUserId"]),

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
        score: v.union(v.number(), v.null()),
        optedOut: v.optional(v.boolean()),
      }),
    ),
    totalScore: v.number(),
    submittedAt: v.number(),
  })
    .index("by_judge_and_team", ["judgeId", "teamId"])
    .index("by_event", ["eventId"])
    .index("by_team", ["teamId"]),

  prizes: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("general"),
      v.literal("track"),
      v.literal("sponsor"),
      v.literal("track_sponsor"),
    ),
    track: v.optional(v.string()),
    sponsorName: v.optional(v.string()),
    // How to surface scoring insight when deliberating this prize
    scoreBasis: v.optional(
      v.union(v.literal("overall"), v.literal("categories"), v.literal("none")),
    ),
    scoreCategoryNames: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_event", ["eventId"])
    .index("by_event_and_active", ["eventId", "isActive"])
    .index("by_event_and_track", ["eventId", "track"])
    .index("by_event_and_sponsor", ["eventId", "sponsorName"]),

  teamPrizeSubmissions: defineTable({
    eventId: v.id("events"),
    teamId: v.id("teams"),
    prizeId: v.id("prizes"),
    submittedAt: v.number(),
    submittedBy: v.optional(v.id("users")),
  })
    .index("by_event", ["eventId"])
    .index("by_team", ["teamId"])
    .index("by_prize", ["prizeId"])
    .index("by_team_and_prize", ["teamId", "prizeId"])
    .index("by_event_and_team", ["eventId", "teamId"])
    .index("by_event_and_prize", ["eventId", "prizeId"]),

  prizeWinners: defineTable({
    eventId: v.id("events"),
    prizeId: v.id("prizes"),
    teamId: v.id("teams"),
    placement: v.optional(v.number()),
    notes: v.optional(v.string()),
    selectedAt: v.number(),
    selectedBy: v.id("users"),
  })
    .index("by_event", ["eventId"])
    .index("by_prize", ["prizeId"])
    .index("by_event_and_prize", ["eventId", "prizeId"]),

  // Demo Day appreciations table
  appreciations: defineTable({
    eventId: v.id("events"),
    teamId: v.id("teams"), // teams function as projects
    attendeeId: v.string(), // UUID stored client-side
    fingerprintKey: v.string(), // SHA-256 hash (device fingerprint)
    ipAddress: v.string(),
    userAgent: v.string(),
    timestamp: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_team", ["teamId"])
    .index("by_event_and_attendee", ["eventId", "attendeeId"])
    .index("by_event_and_team_and_attendee", [
      "eventId",
      "teamId",
      "attendeeId",
    ])
    .index("by_ip_and_timestamp", ["ipAddress", "timestamp"]),
};

export default defineSchema({
  ...customAuthTables,
  ...applicationTables,
});
