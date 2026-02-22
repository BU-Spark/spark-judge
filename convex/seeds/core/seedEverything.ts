import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";

export async function seedEverythingHandler(ctx: MutationCtx) {
  const userId = await ensureSeedAdminUser(ctx);

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
        { name: "Innovation", weight: 1 },
        { name: "Technical Implementation", weight: 1.2 },
        { name: "Design", weight: 1 },
        { name: "Impact", weight: 1.3 },
        { name: "Presentation", weight: 0.8 },
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
        { name: "AI Innovation", weight: 1.2 },
        { name: "Technical Complexity", weight: 1.4 },
        { name: "User Experience", weight: 1.1 },
        { name: "Scalability", weight: 1 },
        { name: "Presentation", weight: 0.9 },
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
      categories: [
        { name: "Innovation", weight: 1 },
        { name: "Security", weight: 1.5 },
        { name: "User Experience", weight: 1.1 },
        { name: "Impact", weight: 1.2 },
      ],
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
        track: event.categories[j % event.categories.length].name,
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
      const teamsToScore = Math.random() > 0.3 ? teams.length : teams.length - 1;

      for (let i = 0; i < teamsToScore; i++) {
        const team = teams[i];
        const categoryScores = event.categories.map((catObj) => ({
          category: catObj.name,
          // Random scores between 2-5, with a bias toward 3-4
          score: Math.floor(Math.random() * 3) + 2 + (Math.random() > 0.7 ? 1 : 0),
        }));

        const totalScore = categoryScores.reduce((sum, cs) => {
          const category = event.categories.find((c) => c.name === cs.category);
          const weight = category?.weight ?? 1;
          return sum + cs.score * weight;
        }, 0);

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
}
