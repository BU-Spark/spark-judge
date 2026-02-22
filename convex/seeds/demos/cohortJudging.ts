import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";

export async function seedCohortJudgingDemoHandler(ctx: MutationCtx) {
  const userId = await ensureSeedAdminUser(ctx);

  // Get current date for relative date calculations
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // Create cohort judging event (50 teams)
  const eventId = await ctx.db.insert("events", {
    name: "Mega Hackathon 2024 - Cohort Judging Demo",
    description:
      "Large-scale hackathon demonstrating cohort judging mode. With 50 teams, judges select their own teams to score, making the judging process more manageable.",
    startDate: now.getTime() - day,
    endDate: now.getTime() + day,
    status: "active" as const,
    enableCohorts: true,
    categories: [
      { name: "Innovation", weight: 1.0 },
      { name: "Technical Implementation", weight: 1.2, optOutAllowed: false },
      { name: "Design", weight: 1.0 },
      { name: "Impact", weight: 1.3 },
      { name: "Presentation", weight: 0.8, optOutAllowed: true },
      { name: "Accessibility", weight: 0.9, optOutAllowed: true },
    ],
    resultsReleased: false,
    judgeCode: "COHORT2024",
  });

  // Add current user as a judge
  await ctx.db.insert("judges", {
    userId,
    eventId,
  });

  // Generate 50 diverse team names
  const teamNamePrefixes = [
    "Quantum",
    "Neural",
    "Cloud",
    "Data",
    "AI",
    "Blockchain",
    "Mobile",
    "Web",
    "VR",
    "AR",
    "IoT",
    "Cybersecurity",
    "FinTech",
    "HealthTech",
    "EdTech",
    "Green",
    "Social",
    "Gaming",
    "Music",
    "Art",
    "Food",
    "Travel",
    "Fitness",
    "Finance",
    "Education",
    "Healthcare",
    "Retail",
    "Logistics",
    "Real Estate",
    "Media",
  ];

  const teamNameSuffixes = [
    "Labs",
    "Studio",
    "Works",
    "Solutions",
    "Systems",
    "Platform",
    "Hub",
    "Space",
    "Forge",
    "Builders",
    "Creators",
    "Innovators",
    "Pioneers",
    "Ventures",
    "Tech",
    "Digital",
    "Smart",
    "Next",
    "Future",
    "Prime",
    "Elite",
    "Pro",
    "Plus",
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
    "Gamified fitness app with social challenges",
    "Real-time language translation using neural networks",
    "Sustainable fashion marketplace with carbon tracking",
    "Mental health chatbot with AI counseling support",
    "Food waste reduction platform connecting restaurants and charities",
    "Cybersecurity dashboard for small businesses",
    "Music discovery app using machine learning",
    "Educational platform for coding bootcamps",
    "Logistics optimization tool for delivery services",
    "Healthcare appointment scheduling with AI recommendations",
    "Real estate platform with virtual property tours",
    "Media analytics dashboard for content creators",
    "Travel planning app with personalized itineraries",
    "Retail inventory management using computer vision",
    "Green energy monitoring system for homes",
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
    "Sam",
    "Jamie",
    "Charlie",
    "Noah",
    "Emma",
    "Olivia",
    "Liam",
    "Sophia",
    "Mason",
    "Isabella",
    "Ethan",
    "Mia",
    "James",
    "Charlotte",
    "Benjamin",
    "Amelia",
  ];

  // Create 50 teams
  const teamIds: Id<"teams">[] = [];
  for (let i = 0; i < 50; i++) {
    const prefix = teamNamePrefixes[i % teamNamePrefixes.length];
    const suffix =
      teamNameSuffixes[
        Math.floor(i / teamNamePrefixes.length) % teamNameSuffixes.length
      ];
    const teamName = `${prefix} ${suffix}${
      i >= teamNamePrefixes.length
        ? ` ${Math.floor(i / (teamNamePrefixes.length * teamNameSuffixes.length)) + 1}`
        : ""
    }`;

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
      name: teamName,
      description: projectDescriptions[i % projectDescriptions.length],
      members: members,
      projectUrl: `https://github.com/${teamName.toLowerCase().replace(/\s+/g, "-")}/project`,
      githubUrl: `https://github.com/${teamName.toLowerCase().replace(/\s+/g, "-")}/project`,
      track: "",
      submittedBy: userId,
      submittedAt: now.getTime() - day + Math.random() * day,
    });
    teamIds.push(teamId);
  }

  // Create 6 judges
  const judgeNames = [
    "Dr. Sarah Chen",
    "Prof. Michael Rodriguez",
    "Alex Thompson",
    "Jordan Lee",
    "Dr. Emily Watson",
    "Prof. David Kim",
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

  // Assign teams to judges (cohort mode)
  // Each judge gets 8-12 teams, with some overlap
  const teamsPerJudge = [10, 12, 8, 11, 9, 10]; // Total: 60 assignments (some teams judged by multiple judges)
  let assignmentCount = 0;
  let teamIndex = 0;

  for (let judgeIdx = 0; judgeIdx < judgeIds.length; judgeIdx++) {
    const judgeId = judgeIds[judgeIdx];
    const numTeams = teamsPerJudge[judgeIdx];

    // Distribute teams across the list with some overlap
    const startIdx = teamIndex;
    const endIdx = Math.min(startIdx + numTeams, teamIds.length);

    for (let i = startIdx; i < endIdx; i++) {
      await ctx.db.insert("judgeAssignments", {
        judgeId,
        eventId: eventId,
        teamId: teamIds[i],
        addedAt: now.getTime() - Math.random() * 86400000,
      });
      assignmentCount++;
    }

    // Wrap around for overlap
    teamIndex = (teamIndex + Math.floor(numTeams * 0.7)) % teamIds.length;
  }

  // Create scores for judges (varying completion levels)
  let scoresCreated = 0;
  const scoreCompletionRates = [1.0, 0.8, 0.6, 0.4, 0.2, 0.0]; // Judge 1: complete, Judge 2: 80%, etc.

  for (let judgeIdx = 0; judgeIdx < judgeIds.length; judgeIdx++) {
    const judgeId = judgeIds[judgeIdx];
    const completionRate = scoreCompletionRates[judgeIdx];

    // Get assigned teams for this judge
    const assignments = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_event", (q) =>
        q.eq("judgeId", judgeId).eq("eventId", eventId)
      )
      .collect();

    const teamsToScore = Math.floor(assignments.length * completionRate);

    for (let i = 0; i < teamsToScore; i++) {
      const assignment = assignments[i];
      const event = await ctx.db.get(eventId);
      if (!event) continue;

      // Create category scores with some opt-outs
      const categoryScores = event.categories.map((catObj) => {
        // 10% chance of opt-out if allowed
        const shouldOptOut = catObj.optOutAllowed && Math.random() < 0.1;

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
        teamId: assignment.teamId,
        eventId: eventId,
        categoryScores,
        totalScore,
        submittedAt: now.getTime() - Math.random() * 86400000,
      });
      scoresCreated++;
    }
  }

  return {
    message: `Successfully created cohort judging demo with ${teamIds.length} teams, ${judgeIds.length} judges, ${assignmentCount} team assignments, and ${scoresCreated} scores`,
    eventId,
    teamsCreated: teamIds.length,
    judgesCreated: judgeIds.length,
    assignmentsCreated: assignmentCount,
    scoresCreated,
  };
}
