import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const seedEvents = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing events (optional)
    const existingEvents = await ctx.db.query("events").collect();
    for (const event of existingEvents) {
      await ctx.db.delete(event._id);
    }

    // Get current date for relative date calculations
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    // Seed events data
    const events = [
      // Active Events
      {
        name: "HackBU Fall 2024",
        description:
          "Boston University's premier 24-hour hackathon. Build innovative solutions, attend workshops, and compete for amazing prizes!",
        startDate: now.getTime() - day,
        endDate: now.getTime() + day,
        status: "active" as const,
        categories: [
          "Innovation",
          "Technical Implementation",
          "Design",
          "Impact",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 42,
      },
      {
        name: "AI Innovation Challenge",
        description:
          "48-hour AI hackathon focused on building practical AI applications using cutting-edge LLMs and computer vision.",
        startDate: now.getTime() - 2 * day,
        endDate: now.getTime() + 2 * day,
        status: "active" as const,
        categories: [
          "AI Innovation",
          "Technical Complexity",
          "User Experience",
          "Scalability",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 28,
      },

      // Upcoming Events
      {
        name: "Web3 Builder Weekend",
        description:
          "Explore the future of decentralized applications. Learn Solidity, build DApps, and create the next breakthrough in blockchain.",
        startDate: now.getTime() + 7 * day,
        endDate: now.getTime() + 9 * day,
        status: "upcoming" as const,
        categories: [
          "Smart Contract Security",
          "DApp Usability",
          "Innovation",
          "Technical Excellence",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 0,
      },
      {
        name: "HealthTech Hackathon",
        description:
          "Revolutionize healthcare with technology. Partner with Boston hospitals to solve real medical challenges.",
        startDate: now.getTime() + 14 * day,
        endDate: now.getTime() + 16 * day,
        status: "upcoming" as const,
        categories: [
          "Clinical Impact",
          "Innovation",
          "Technical Implementation",
          "User Experience",
          "Scalability",
        ],
        resultsReleased: false,
        teamCount: 0,
      },
      {
        name: "Climate Action Hack",
        description:
          "Code for our planet! Build sustainable tech solutions to combat climate change and promote environmental conservation.",
        startDate: now.getTime() + 21 * day,
        endDate: now.getTime() + 22 * day,
        status: "upcoming" as const,
        categories: [
          "Environmental Impact",
          "Innovation",
          "Technical Solution",
          "Feasibility",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 0,
      },

      // Past Events
      {
        name: "Spring Hack 2024",
        description:
          "Our flagship spring hackathon brought together 200+ hackers to build amazing projects over an intense weekend.",
        startDate: now.getTime() - 60 * day,
        endDate: now.getTime() - 58 * day,
        status: "past" as const,
        categories: [
          "Innovation",
          "Technical Excellence",
          "Design",
          "Impact",
          "Presentation",
        ],
        resultsReleased: true,
        teamCount: 52,
      },
      {
        name: "FinTech Innovation Lab",
        description:
          "Disrupting finance with code. Teams built solutions for payments, investing, and financial inclusion.",
        startDate: now.getTime() - 30 * day,
        endDate: now.getTime() - 28 * day,
        status: "past" as const,
        categories: [
          "Financial Impact",
          "Innovation",
          "Security",
          "User Experience",
          "Scalability",
        ],
        resultsReleased: true,
        teamCount: 35,
      },
      {
        name: "Game Jam 2024",
        description:
          "48 hours to create the next indie game sensation. From concept to playable demo in one weekend.",
        startDate: now.getTime() - 90 * day,
        endDate: now.getTime() - 88 * day,
        status: "past" as const,
        categories: [
          "Gameplay",
          "Graphics",
          "Sound Design",
          "Innovation",
          "Fun Factor",
        ],
        resultsReleased: true,
        teamCount: 24,
      },
    ];

    // Insert all events
    const eventIds = [];
    for (const event of events) {
      const { teamCount: _teamCount, ...eventData } = event;
      const id = await ctx.db.insert("events", eventData);
      eventIds.push(id);
    }

    // Create some dummy teams for active and past events
    const teamNames = [
      "Code Crusaders",
      "Bit Wizards",
      "Debug Dynasty",
      "Syntax Squad",
      "The Recursives",
      "Stack Overflow",
      "Neural Ninjas",
      "Quantum Coders",
      "Binary Brigade",
      "Cache Money",
      "Git Committed",
      "Array of Sunshine",
      "The Null Pointers",
      "Exception Handlers",
      "Runtime Terror",
      "Merge Conflicts",
    ];

    const projectTypes = [
      "AI-powered study assistant",
      "Blockchain voting system",
      "Mental health chatbot",
      "Carbon footprint tracker",
      "Smart home automation",
      "Virtual reality education",
      "Crowd-sourced delivery app",
      "Medical diagnosis tool",
      "Social media analyzer",
      "Sustainable fashion marketplace",
      "Fitness tracking platform",
      "Language learning game",
    ];

    // Add teams to active and past events
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Skip upcoming events
      if (event.status === "upcoming") continue;

      const eventId = eventIds[i];
      const teamCount = event.teamCount;

      for (let j = 0; j < Math.min(teamCount, 10); j++) {
        // Add up to 10 teams per event for demo
        await ctx.db.insert("teams", {
          eventId: eventId,
          name: teamNames[j % teamNames.length],
          description: projectTypes[j % projectTypes.length],
          members: [
            `Member ${j * 3 + 1}`,
            `Member ${j * 3 + 2}`,
            `Member ${j * 3 + 3}`,
          ],
          projectUrl: `https://github.com/team${j}/hackathon-project`,
          githubUrl: "",
          track: "",
          submittedBy: "uiuu" as Id<"users">,
          submittedAt: 0,
        });
      }
    }

    return {
      message: "Successfully seeded database with dummy events and teams",
      eventsCreated: events.length,
      eventIds,
    };
  },
});

export const seedJudgeScores = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    judgesCreated: v.number(),
    scoresCreated: v.number(),
  }),
  handler: async (ctx) => {
    // Get all active and past events
    const events = await ctx.db.query("events").collect();
    const scorableEvents = events.filter(
      (e) => e.status === "active" || e.status === "past"
    );

    if (scorableEvents.length === 0) {
      return {
        message: "No active or past events found to score",
        judgesCreated: 0,
        scoresCreated: 0,
      };
    }

    // Create demo judge users
    const judgeNames = [
      "Dr. Sarah Chen",
      "Prof. Michael Rodriguez",
      "Alex Thompson",
      "Jordan Lee",
      "Dr. Emily Watson",
    ];

    const judgeIds: Id<"users">[] = [];

    for (const name of judgeNames) {
      const userId = await ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@judges.com`,
        emailVerificationTime: Date.now(),
        isAnonymous: false,
      });
      judgeIds.push(userId);
    }

    let scoresCreated = 0;

    // For each event, add judges and create scores
    for (const event of scorableEvents) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      if (teams.length === 0) continue;

      // Add 3-4 judges per event (randomly)
      const numJudges = Math.floor(Math.random() * 2) + 3; // 3 or 4 judges
      const eventJudgeIds: Id<"judges">[] = [];

      for (let i = 0; i < numJudges; i++) {
        // Make the first judge a global admin
        if (i === 0) {
          await ctx.db.patch(judgeIds[i], { isAdmin: true });
        }

        const judgeId = await ctx.db.insert("judges", {
          userId: judgeIds[i],
          eventId: event._id,
        });
        eventJudgeIds.push(judgeId);
      }

      // Each judge scores most teams (some judges might miss a team or two)
      for (const judgeId of eventJudgeIds) {
        const teamsToScore =
          Math.random() > 0.3 ? teams.length : teams.length - 1; // 70% score all teams

        for (let i = 0; i < teamsToScore; i++) {
          const team = teams[i];
          const categoryScores = event.categories.map((category) => ({
            category,
            // Random scores between 1-5, with a bias toward 3-4
            score:
              Math.floor(Math.random() * 3) + 2 + (Math.random() > 0.7 ? 1 : 0),
          }));

          const totalScore = categoryScores.reduce(
            (sum, cs) => sum + cs.score,
            0
          );

          await ctx.db.insert("scores", {
            judgeId,
            teamId: team._id,
            eventId: event._id,
            categoryScores,
            totalScore,
            submittedAt: Date.now() - Math.random() * 86400000, // Scores from last 24 hours
          });
          scoresCreated++;
        }
      }
    }

    return {
      message: `Successfully seeded ${judgeIds.length} judges and ${scoresCreated} scores`,
      judgesCreated: judgeIds.length,
      scoresCreated,
    };
  },
});

export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear events
    const events = await ctx.db.query("events").collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    // Clear teams
    const teams = await ctx.db.query("teams").collect();
    for (const team of teams) {
      await ctx.db.delete(team._id);
    }

    // Clear scores
    const scores = await ctx.db.query("scores").collect();
    for (const score of scores) {
      await ctx.db.delete(score._id);
    }

    // Clear judges
    const judges = await ctx.db.query("judges").collect();
    for (const judge of judges) {
      await ctx.db.delete(judge._id);
    }

    // Clear participants
    const participants = await ctx.db.query("participants").collect();
    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }

    // Clear ALL auth-related tables
    try {
      const authSessions = await ctx.db.query("authSessions").collect();
      for (const session of authSessions) {
        await ctx.db.delete(session._id);
      }
    } catch {
      console.log("No authSessions table or already empty");
    }

    try {
      const authAccounts = await ctx.db.query("authAccounts").collect();
      for (const account of authAccounts) {
        await ctx.db.delete(account._id);
      }
    } catch {
      console.log("No authAccounts table or already empty");
    }

    try {
      const authVerificationCodes = await ctx.db
        .query("authVerificationCodes")
        .collect();
      for (const code of authVerificationCodes) {
        await ctx.db.delete(code._id);
      }
    } catch {
      console.log("No authVerificationCodes table or already empty");
    }

    try {
      const authVerifiers = await ctx.db.query("authVerifiers").collect();
      for (const verifier of authVerifiers) {
        await ctx.db.delete(verifier._id);
      }
    } catch {
      console.log("No authVerifiers table or already empty");
    }

    try {
      const authRefreshTokens = await ctx.db
        .query("authRefreshTokens")
        .collect();
      for (const token of authRefreshTokens) {
        await ctx.db.delete(token._id);
      }
    } catch {
      console.log("No authRefreshTokens table or already empty");
    }

    // Clear users LAST (be careful with this!)
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    return {
      message: "All data cleared successfully including all auth data",
      cleared: {
        events: events.length,
        teams: teams.length,
        scores: scores.length,
        judges: judges.length,
        participants: participants.length,
        users: users.length,
      },
    };
  },
});

export const makeCurrentUserAdminForAllEvents = mutation({
  args: {},
  handler: async (ctx) => {
    let userId = await getAuthUserId(ctx);

    // Filter out fake/test IDs from dashboard
    if (userId && (userId === "fake_id" || userId.startsWith("fake"))) {
      userId = null;
    }

    if (!userId) {
      throw new Error(
        "You must be signed into the app (not just the Convex dashboard). Open your app, sign in with Google, then run this function again."
      );
    }

    // Make user a global admin
    await ctx.db.patch(userId, { isAdmin: true });

    // Add them as a judge to all events they're not already judging
    const events = await ctx.db.query("events").collect();
    let added = 0;

    for (const event of events) {
      // Check if already a judge
      const existing = await ctx.db
        .query("judges")
        .withIndex("by_user_and_event", (q) =>
          q.eq("userId", userId).eq("eventId", event._id)
        )
        .first();

      if (!existing) {
        // Add as judge
        await ctx.db.insert("judges", {
          userId,
          eventId: event._id,
        });
        added++;
      }
    }

    return {
      message: `Made you a global admin and added you as judge to ${added} events`,
      userId,
    };
  },
});

export const makeUserAdminByEmail = mutation({
  args: { email: v.string() },
  returns: v.object({
    message: v.string(),
    userId: v.optional(v.id("users")),
  }),
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return {
        message: `No user found with email: ${args.email}`,
      };
    }

    // Make user a global admin
    await ctx.db.patch(user._id, { isAdmin: true });

    // Add them as a judge to all events they're not already judging
    const events = await ctx.db.query("events").collect();
    let added = 0;

    for (const event of events) {
      // Check if already a judge
      const existing = await ctx.db
        .query("judges")
        .withIndex("by_user_and_event", (q) =>
          q.eq("userId", user._id).eq("eventId", event._id)
        )
        .first();

      if (!existing) {
        // Add as judge
        await ctx.db.insert("judges", {
          userId: user._id,
          eventId: event._id,
        });
        added++;
      }
    }

    return {
      message: `Made ${args.email} a global admin and added them as judge to ${added} events`,
      userId: user._id,
    };
  },
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
  handler: async (ctx) => {
    let userId = await getAuthUserId(ctx);

    // Check if userId is valid (not a test/fake ID from dashboard)
    if (
      userId &&
      userId.startsWith &&
      (userId === "fake_id" || userId.startsWith("fake"))
    ) {
      userId = null;
    }

    // If no valid user is authenticated, create a demo admin user
    if (!userId) {
      userId = await ctx.db.insert("users", {
        name: "Demo Admin",
        email: "admin@demo.com",
        emailVerificationTime: Date.now(),
        isAnonymous: false,
      });
    } else {
      // Verify the user actually exists in the database
      const existingUser = await ctx.db.get(userId);
      if (!existingUser) {
        // User ID exists in auth but not in users table - create them
        userId = await ctx.db.insert("users", {
          name: "Demo Admin",
          email: "admin@demo.com",
          emailVerificationTime: Date.now(),
          isAnonymous: false,
        });
      }
    }

    // Get current date for relative date calculations
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    // Seed events data
    const events = [
      // Active Events
      {
        name: "HackBU Fall 2024",
        description:
          "Boston University's premier 24-hour hackathon. Build innovative solutions, attend workshops, and compete for amazing prizes!",
        startDate: now.getTime() - day,
        endDate: now.getTime() + day,
        status: "active" as const,
        categories: [
          "Innovation",
          "Technical Implementation",
          "Design",
          "Impact",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 15,
      },
      {
        name: "AI Innovation Challenge",
        description:
          "48-hour AI hackathon focused on building practical AI applications using cutting-edge LLMs and computer vision.",
        startDate: now.getTime() - 2 * day,
        endDate: now.getTime() + 2 * day,
        status: "active" as const,
        categories: [
          "AI Innovation",
          "Technical Complexity",
          "User Experience",
          "Scalability",
          "Presentation",
        ],
        resultsReleased: false,
        teamCount: 12,
      },
      {
        name: "Web3 Builder Weekend",
        description:
          "Decentralize the future! Build blockchain apps, smart contracts, and Web3 experiences.",
        startDate: now.getTime() - 3 * day,
        endDate: now.getTime() + day,
        status: "active" as const,
        categories: ["Innovation", "Security", "User Experience", "Impact"],
        resultsReleased: false,
        teamCount: 10,
      },
    ];

    const teamNames = [
      "Code Crusaders",
      "Bit Wizards",
      "Debug Dynasty",
      "Syntax Squad",
      "The Recursives",
      "Stack Overflow",
      "Neural Ninjas",
      "Quantum Coders",
      "Binary Brigade",
      "Cache Money",
      "Git Committed",
      "Array of Sunshine",
      "The Null Pointers",
      "Exception Handlers",
      "Runtime Terror",
      "Merge Conflicts",
    ];

    const projectTypes = [
      "AI-powered study assistant",
      "Blockchain voting system",
      "Mental health chatbot",
      "Carbon footprint tracker",
      "Smart home automation",
      "Virtual reality education",
      "Crowd-sourced delivery app",
      "Medical diagnosis tool",
      "Social media analyzer",
      "Sustainable fashion marketplace",
      "Fitness tracking platform",
      "Language learning game",
    ];

    const judgeNames = [
      "Dr. Sarah Chen",
      "Prof. Michael Rodriguez",
      "Alex Thompson",
      "Jordan Lee",
      "Dr. Emily Watson",
    ];

    // Make current user a global admin
    await ctx.db.patch(userId, { isAdmin: true });

    // Insert all events and make current user admin
    const eventIds: Id<"events">[] = [];
    let totalTeams = 0;

    for (const event of events) {
      const { teamCount, ...eventData } = event;
      const eventId = await ctx.db.insert("events", eventData);
      eventIds.push(eventId);

      // Add current user as a judge for this event
      await ctx.db.insert("judges", {
        userId,
        eventId,
      });

      // Add teams
      for (let j = 0; j < Math.min(teamCount, 10); j++) {
        await ctx.db.insert("teams", {
          eventId: eventId,
          name: `${teamNames[j % teamNames.length]} ${String.fromCharCode(65 + Math.floor(j / teamNames.length))}`,
          description: projectTypes[j % projectTypes.length],
          members: [
            `Member ${j * 3 + 1}`,
            `Member ${j * 3 + 2}`,
            `Member ${j * 3 + 3}`,
          ],
          projectUrl: `https://github.com/team${j}/hackathon-project`,
          githubUrl: `https://github.com/team${j}/hackathon-project`,
          track: event.categories[j % event.categories.length],
          submittedBy: userId,
          submittedAt: now.getTime() - day,
        });
        totalTeams++;
      }
    }

    // Create demo judge users
    const judgeIds: Id<"users">[] = [];
    for (const name of judgeNames) {
      const judgeUserId = await ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase().replace(/[\s.]/g, "")}@demo.com`,
        emailVerificationTime: Date.now(),
        isAnonymous: false,
      });
      judgeIds.push(judgeUserId);
    }

    let totalJudges = events.length; // Current user is admin judge for all events
    let scoresCreated = 0;

    // For each event, add additional judges and create scores
    for (let eventIndex = 0; eventIndex < eventIds.length; eventIndex++) {
      const eventId = eventIds[eventIndex];
      const event = events[eventIndex];

      const teams = await ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();

      if (teams.length === 0) continue;

      // Add 3-4 judges per event (randomly)
      const numJudges = Math.floor(Math.random() * 2) + 3; // 3 or 4 judges
      const eventJudgeIds: Id<"judges">[] = [];

      for (let i = 0; i < numJudges && i < judgeIds.length; i++) {
        const judgeId = await ctx.db.insert("judges", {
          userId: judgeIds[i],
          eventId: eventId,
        });
        eventJudgeIds.push(judgeId);
        totalJudges++;
      }

      // Each judge scores most teams
      for (const judgeId of eventJudgeIds) {
        const teamsToScore =
          Math.random() > 0.3 ? teams.length : teams.length - 1;

        for (let i = 0; i < teamsToScore; i++) {
          const team = teams[i];
          const categoryScores = event.categories.map((category) => ({
            category,
            // Random scores between 2-5, with a bias toward 3-4
            score:
              Math.floor(Math.random() * 3) + 2 + (Math.random() > 0.7 ? 1 : 0),
          }));

          const totalScore = categoryScores.reduce(
            (sum, cs) => sum + cs.score,
            0
          );

          await ctx.db.insert("scores", {
            judgeId,
            teamId: team._id,
            eventId: eventId,
            categoryScores,
            totalScore,
            submittedAt: Date.now() - Math.random() * 86400000,
          });
          scoresCreated++;
        }
      }
    }

    return {
      message: `Successfully seeded ${events.length} events with ${totalTeams} teams, ${totalJudges} judges, and ${scoresCreated} scores`,
      eventsCreated: events.length,
      teamsCreated: totalTeams,
      judgesCreated: totalJudges,
      scoresCreated,
    };
  },
});
