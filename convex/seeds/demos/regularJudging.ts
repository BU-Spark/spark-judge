import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";

export async function seedRegularJudgingDemoHandler(ctx: MutationCtx) {
  const userId = await ensureSeedAdminUser(ctx);

  // Get current date for relative date calculations
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // Create regular judging event (10 teams)
  const eventId = await ctx.db.insert("events", {
    name: "Spring Hackathon 2024 - Regular Judging Demo",
    description:
      "Smaller hackathon demonstrating standard judging mode. All judges score all teams, perfect for events with fewer teams.",
    startDate: now.getTime() - day,
    endDate: now.getTime() + day,
    status: "active" as const,
    enableCohorts: false,
    categories: [
      { name: "Innovation", weight: 1.0 },
      { name: "Technical Excellence", weight: 1.3 },
      { name: "Design", weight: 1.0 },
      { name: "Impact", weight: 1.2 },
      { name: "Presentation", weight: 0.9, optOutAllowed: true },
    ],
    resultsReleased: false,
  });

  // Add current user as a judge
  await ctx.db.insert("judges", {
    userId,
    eventId,
  });

  // Generate 10 diverse team names
  const teamNames = [
    "Code Crusaders",
    "Neural Ninjas",
    "Quantum Coders",
    "Bit Wizards",
    "Debug Dynasty",
    "Syntax Squad",
    "The Recursives",
    "Stack Overflow",
    "Binary Brigade",
    "Cache Money",
  ];

  const projectDescriptions = [
    "AI-powered platform for personalized learning experiences",
    "Blockchain-based supply chain transparency system",
    "Mobile app connecting volunteers with local community needs",
    "VR training simulator for healthcare professionals",
    "IoT solution for smart city energy management",
    "Machine learning tool for early disease detection",
    "Social platform for sustainable living communities",
    "FinTech app simplifying personal investment strategies",
    "AR navigation system for indoor spaces",
    "Cloud-based collaboration tool for remote teams",
  ];

  const memberNames = [
    "Alex",
    "Jordan",
    "Taylor",
    "Morgan",
    "Casey",
    "Riley",
    "Quinn",
    "Sage",
    "Dakota",
    "River",
    "Phoenix",
    "Blake",
    "Cameron",
    "Avery",
    "Finley",
    "Rowan",
    "Skylar",
    "Emery",
    "Hayden",
    "Reese",
    "Parker",
    "Drew",
    "Logan",
  ];

  // Create 10 teams
  const teamIds: Id<"teams">[] = [];
  for (let i = 0; i < 10; i++) {
    const memberCount = Math.floor(Math.random() * 3) + 2; // 2-4 members
    const members = [];
    const usedIndices = new Set<number>();
    for (let j = 0; j < memberCount; j++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * memberNames.length);
      } while (usedIndices.has(idx));
      usedIndices.add(idx);
      members.push(memberNames[idx]);
    }

    const teamId = await ctx.db.insert("teams", {
      eventId: eventId,
      name: teamNames[i],
      description: projectDescriptions[i],
      members: members,
      projectUrl: `https://github.com/${teamNames[i].toLowerCase().replace(/\s+/g, "-")}/project`,
      githubUrl: `https://github.com/${teamNames[i].toLowerCase().replace(/\s+/g, "-")}/project`,
      track: "",
      submittedBy: userId,
      submittedAt: now.getTime() - day + Math.random() * day,
    });
    teamIds.push(teamId);
  }

  // Create 4 judges
  const judgeNames = [
    "Dr. Sarah Chen",
    "Prof. Michael Rodriguez",
    "Alex Thompson",
    "Jordan Lee",
  ];

  const judgeIds: Id<"judges">[] = [];

  for (const name of judgeNames) {
    const judgeUserId = await ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase().replace(/[\s.]/g, "")}@demo.com`,
      emailVerificationTime: Date.now(),
      isAnonymous: false,
    });

    const judgeId = await ctx.db.insert("judges", {
      userId: judgeUserId,
      eventId: eventId,
    });
    judgeIds.push(judgeId);
  }

  // Create scores for judges (varying completion levels)
  // Judge 1: Complete (10/10), Judge 2: Complete (10/10), Judge 3: Partial (7/10), Judge 4: Partial (4/10)
  let scoresCreated = 0;
  const scoreCompletionRates = [1.0, 1.0, 0.7, 0.4];

  for (let judgeIdx = 0; judgeIdx < judgeIds.length; judgeIdx++) {
    const judgeId = judgeIds[judgeIdx];
    const completionRate = scoreCompletionRates[judgeIdx];
    const teamsToScore = Math.floor(teamIds.length * completionRate);

    const event = await ctx.db.get(eventId);
    if (!event) continue;

    for (let i = 0; i < teamsToScore; i++) {
      const teamId = teamIds[i];

      // Create category scores with some opt-outs
      const categoryScores = event.categories.map((catObj) => {
        // 5% chance of opt-out if allowed
        const shouldOptOut = catObj.optOutAllowed && Math.random() < 0.05;

        return {
          category: catObj.name,
          score: shouldOptOut
            ? null
            : Math.floor(Math.random() * 3) + 2 + (Math.random() > 0.7 ? 1 : 0), // 2-5 with bias toward 3-4
          optedOut: shouldOptOut,
        };
      });

      // Calculate total score
      const totalScore = categoryScores.reduce((sum, cs) => {
        if (cs.optedOut || cs.score === null) return sum;
        const category = event.categories.find((c) => c.name === cs.category);
        const weight = category?.weight ?? 1;
        return sum + cs.score * weight;
      }, 0);

      await ctx.db.insert("scores", {
        judgeId,
        teamId: teamId,
        eventId: eventId,
        categoryScores,
        totalScore,
        submittedAt: now.getTime() - Math.random() * 86400000,
      });
      scoresCreated++;
    }
  }

  return {
    message: `Successfully created regular judging demo with ${teamIds.length} teams, ${judgeIds.length} judges, and ${scoresCreated} scores`,
    eventId,
    teamsCreated: teamIds.length,
    judgesCreated: judgeIds.length,
    scoresCreated,
  };
}
