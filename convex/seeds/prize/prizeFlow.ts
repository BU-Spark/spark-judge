import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";
import {
  clampSeedScore,
  computeSeedTotalScore,
  slugifySeedValue,
} from "../shared/scoring";

type SeedPrizeType = "general" | "track" | "sponsor" | "track_sponsor";
type SeedScoreBasis = "overall" | "categories" | "none";

type SeedPrizeConfig = {
  key: string;
  name: string;
  description: string;
  type: SeedPrizeType;
  track?: string;
  sponsorName?: string;
  scoreBasis: SeedScoreBasis;
  scoreCategoryNames?: string[];
};

type SeedPrizeScenarioResult = {
  eventId: Id<"events">;
  teamsCreated: number;
  judgesCreated: number;
  prizesCreated: number;
  submissionsCreated: number;
  scoresCreated: number;
  winnersCreated: number;
};

async function seedPrizeJudgingScenario(
  ctx: MutationCtx,
  options: {
    name: string;
    lockScoring: boolean;
    includeWinners: boolean;
    enableCohorts?: boolean;
    categories?: { name: string; weight: number; optOutAllowed?: boolean }[];
  }
): Promise<SeedPrizeScenarioResult> {
  const adminUserId = await ensureSeedAdminUser(ctx, {
    name: "Prize Flow Seed Admin",
    emailFactory: () => `prize-seed-admin+${Date.now()}@demo.com`,
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const runKey = now;

  const defaultCategories = [
    { name: "Innovation", weight: 1.2 },
    { name: "Technical Depth", weight: 1.4 },
    { name: "Design", weight: 1.0 },
    { name: "Impact", weight: 1.3 },
    { name: "Presentation", weight: 0.8, optOutAllowed: true },
  ];

  const categories = options.categories || defaultCategories;

  const eventId = await ctx.db.insert("events", {
    name: options.name,
    description:
      "Seeded test event for prize-based judging, prize submissions, and winner selection workflows.",
    startDate: now - day,
    endDate: now + day,
    status: "active",
    enableCohorts: options.enableCohorts,
    categories,
    tracks: ["AI", "Climate", "Fintech"],
    resultsReleased: false,
    scoringLockedAt: options.lockScoring ? now : undefined,
    scoringLockedBy: options.lockScoring ? adminUserId : undefined,
    scoringLockReason: options.lockScoring
      ? "Seeded lock for prize-based judging test"
      : undefined,
  });

  const judgeIds: Id<"judges">[] = [];

  const adminJudgeId = await ctx.db.insert("judges", {
    userId: adminUserId,
    eventId,
  });
  judgeIds.push(adminJudgeId);

  const judgeNames = ["Dr. Riley Harper", "Prof. Jordan Park", "Taylor Morgan"];

  for (const name of judgeNames) {
    const judgeUserId = await ctx.db.insert("users", {
      name,
      email: `${slugifySeedValue(name)}+${runKey}@demo.com`,
      emailVerificationTime: now,
      isAnonymous: false,
    });

    const judgeId = await ctx.db.insert("judges", {
      userId: judgeUserId,
      eventId,
    });
    judgeIds.push(judgeId);
  }

  const teamSeeds = [
    {
      name: "Aurora AI",
      track: "AI",
      description: "Adaptive tutoring assistant for first-generation college students.",
      members: ["Ava", "Noah", "Mia"],
    },
    {
      name: "Model Forge",
      track: "AI",
      description: "Low-latency inference orchestration for multi-model assistants.",
      members: ["Liam", "Sofia", "Ethan"],
    },
    {
      name: "Carbon Cart",
      track: "Climate",
      description: "Scope-3 emissions planner for food supply chains.",
      members: ["Olivia", "Lucas", "Ivy"],
    },
    {
      name: "TideTrace",
      track: "Climate",
      description: "Flood risk simulation and neighborhood adaptation planner.",
      members: ["Mason", "Amelia", "Kai"],
    },
    {
      name: "LedgerLane",
      track: "Fintech",
      description: "SMB treasury forecasting and invoice liquidity assistant.",
      members: ["Emma", "James", "Rory"],
    },
    {
      name: "ClearSettle",
      track: "Fintech",
      description: "Cross-border payment compliance copilot for startups.",
      members: ["Benjamin", "Aria", "Zoe"],
    },
    {
      name: "OpenPulse",
      track: "AI",
      description: "Open-source observability layer for LLM product teams.",
      members: ["Elijah", "Layla", "Leo"],
    },
    {
      name: "GridSpring",
      track: "Climate",
      description: "Community micro-grid coordination and outage response app.",
      members: ["Henry", "Chloe", "Nora"],
    },
  ];

  const generatedTeamSeeds = [];
  const totalTeams = 42;
  for (let i = 0; i < totalTeams; i++) {
    const baseTeam = teamSeeds[i % teamSeeds.length];
    const isOriginal = i < teamSeeds.length;
    generatedTeamSeeds.push({
      ...baseTeam,
      name: isOriginal ? baseTeam.name : `${baseTeam.name} - Team ${i + 1}`,
    });
  }

  const teamIds: Id<"teams">[] = [];
  for (const team of generatedTeamSeeds) {
    const slug = slugifySeedValue(team.name);
    const teamId = await ctx.db.insert("teams", {
      eventId,
      name: team.name,
      description: team.description,
      members: team.members,
      projectUrl: `https://demo.devpost.com/${slug}`,
      githubUrl: `https://github.com/demo/${slug}`,
      track: team.track,
      submittedBy: adminUserId,
      submittedAt: now - 3 * 60 * 60 * 1000,
    });
    teamIds.push(teamId);
  }

  let assignmentCount = 0;
  if (options.enableCohorts) {
    const teamsPerJudge = 15;
    let teamIndex = 0;

    for (let judgeIdx = 0; judgeIdx < judgeIds.length; judgeIdx++) {
      const judgeId = judgeIds[judgeIdx];

      const startIdx = teamIndex;
      const endIdx = Math.min(startIdx + teamsPerJudge, teamIds.length);

      for (let i = startIdx; i < endIdx; i++) {
        await ctx.db.insert("judgeAssignments", {
          judgeId,
          eventId,
          teamId: teamIds[i],
          addedAt: now - Math.random() * day,
        });
        assignmentCount++;
      }

      // Wrap around for overlap
      teamIndex = (teamIndex + 10) % teamIds.length;
    }
  }

  const prizeSeeds: SeedPrizeConfig[] = [
    // General Prizes
    { key: "grand", name: "Grand Prize", description: "Best overall project across all judging criteria.", type: "general", scoreBasis: "overall" },
    { key: "best_design", name: "Best Design", description: "Project with the most exceptional user interface and experience.", type: "general", scoreBasis: "categories", scoreCategoryNames: ["Design"] },
    { key: "best_pitch", name: "Best Pitch", description: "Team with the most compelling presentation.", type: "general", scoreBasis: "categories", scoreCategoryNames: ["Presentation"] },
    { key: "community_choice", name: "Community Choice", description: "Favorite project voted by the attendees.", type: "general", scoreBasis: "none" },

    // AI Track
    { key: "best_ai", name: "Best in AI", description: "Top project in the AI track.", type: "track", track: "AI", scoreBasis: "categories", scoreCategoryNames: ["Innovation", "Technical Depth"] },
    { key: "innovative_ai", name: "Most Innovative AI", description: "Most novel application of artificial intelligence.", type: "track", track: "AI", scoreBasis: "categories", scoreCategoryNames: ["Innovation"] },

    // Climate Track
    { key: "climate_impact", name: "Climate Impact Award", description: "Project with strongest measurable climate outcome.", type: "track", track: "Climate", scoreBasis: "categories", scoreCategoryNames: ["Impact", "Innovation"] },
    { key: "climate_hardware", name: "Best Climate Hardware", description: "Outstanding physical prototype for environmental sustainability.", type: "track", track: "Climate", scoreBasis: "categories", scoreCategoryNames: ["Technical Depth"] },

    // Fintech Track
    { key: "best_fintech", name: "Best in Fintech", description: "Top project in the Fintech track.", type: "track", track: "Fintech", scoreBasis: "categories", scoreCategoryNames: ["Technical Depth", "Impact"] },
    { key: "fintech_inclusivity", name: "Financial Inclusivity App", description: "Best solution promoting access to financial services.", type: "track", track: "Fintech", scoreBasis: "categories", scoreCategoryNames: ["Impact"] },

    // Sponsors
    { key: "sponsor_nebula", name: "Sponsor Choice - Nebula Ventures", description: "Sponsor-selected team regardless of track.", type: "sponsor", sponsorName: "Nebula Ventures", scoreBasis: "none" },
    { key: "sponsor_quantum", name: "Quantum Code Excellence", description: "Best use of Quantum Code's developer APIs.", type: "sponsor", sponsorName: "Quantum Code", scoreBasis: "none" },

    // Track Sponsors
    { key: "fintech_atlas", name: "Fintech x Atlas Bank", description: "Best fintech project with practical deployment readiness.", type: "track_sponsor", track: "Fintech", sponsorName: "Atlas Bank", scoreBasis: "overall" },
    { key: "climate_greenops", name: "Clean Energy Award x GreenOps", description: "Best grid optimization solution.", type: "track_sponsor", track: "Climate", sponsorName: "GreenOps", scoreBasis: "overall" },
    { key: "ai_synthdata", name: "Best Use of API x SynthData", description: "Exceptional integration of SynthData's platform.", type: "track_sponsor", track: "AI", sponsorName: "SynthData", scoreBasis: "overall" }
  ];

  const prizeIdsByKey = new Map<string, Id<"prizes">>();
  for (let index = 0; index < prizeSeeds.length; index += 1) {
    const prize = prizeSeeds[index];
    const prizeId = await ctx.db.insert("prizes", {
      eventId,
      name: prize.name,
      description: prize.description,
      type: prize.type,
      track: prize.track,
      sponsorName: prize.sponsorName,
      scoreBasis: prize.scoreBasis,
      scoreCategoryNames: prize.scoreCategoryNames,
      isActive: true,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
      createdBy: adminUserId,
    });
    prizeIdsByKey.set(prize.key, prizeId);
  }

  const submissionsByPrize = new Map<string, Id<"teams">[]>();
  let submissionsCreated = 0;

  for (let index = 0; index < teamIds.length; index += 1) {
    const teamId = teamIds[index];
    const teamTrack = generatedTeamSeeds[index].track;
    const submittedPrizeKeys = ["grand", "best_design", "best_pitch", "community_choice"];

    if (Math.random() > 0.4) submittedPrizeKeys.push("sponsor_nebula");
    if (Math.random() > 0.4) submittedPrizeKeys.push("sponsor_quantum");

    if (teamTrack === "AI") submittedPrizeKeys.push("best_ai", "innovative_ai", "ai_synthdata");
    if (teamTrack === "Climate") submittedPrizeKeys.push("climate_impact", "climate_hardware", "climate_greenops");
    if (teamTrack === "Fintech") submittedPrizeKeys.push("best_fintech", "fintech_inclusivity", "fintech_atlas");

    for (const prizeKey of submittedPrizeKeys) {
      const prizeId = prizeIdsByKey.get(prizeKey);
      if (!prizeId) continue;

      await ctx.db.insert("teamPrizeSubmissions", {
        eventId,
        teamId,
        prizeId,
        submittedAt: now - 2 * 60 * 60 * 1000,
        submittedBy: adminUserId,
      });
      submissionsCreated++;

      const existing = submissionsByPrize.get(prizeKey) || [];
      existing.push(teamId);
      submissionsByPrize.set(prizeKey, existing);
    }
  }

  let scoresCreated = 0;
  const teamStrength = Array.from({ length: teamIds.length }, (_, i) => 3.6 + ((i * 7) % 12) / 10);

  const judgeBias = [0.0, 0.2, -0.1, 0.1];
  const defaultCategoryBias = [0.0, 0.1, -0.1, 0.2, 0.0];

  for (let judgeIndex = 0; judgeIndex < judgeIds.length; judgeIndex += 1) {
    const judgeId = judgeIds[judgeIndex];

    let assignedTeamIds = teamIds;
    if (options.enableCohorts) {
      const assignments = await ctx.db
        .query("judgeAssignments")
        .withIndex("by_judge_and_event", (q) =>
          q.eq("judgeId", judgeId).eq("eventId", eventId)
        )
        .collect();

      assignedTeamIds = assignments.map(a => a.teamId);
    }

    for (const assignedTeamId of assignedTeamIds) {
      const teamIndex = teamIds.indexOf(assignedTeamId);

      const categoryScores = categories.map((category, categoryIndex) => {
        const shouldOptOut =
          category.name === "Presentation" && judgeIndex === 2 && teamIndex === 5;

        // Dynamic categoryBias so adding a 6th category doesn't crash
        const catBias = categoryIndex < defaultCategoryBias.length ? defaultCategoryBias[categoryIndex] : 0.1;

        const rawScore =
          teamStrength[teamIndex] + judgeBias[judgeIndex] + catBias;
        const score = shouldOptOut ? null : clampSeedScore(rawScore);

        return {
          category: category.name,
          score,
          optedOut: shouldOptOut,
        };
      });

      const totalScore = computeSeedTotalScore(categoryScores, categories);

      await ctx.db.insert("scores", {
        judgeId,
        teamId: assignedTeamId,
        eventId,
        categoryScores,
        totalScore,
        submittedAt: now - (judgeIndex + 1) * 20 * 60 * 1000,
      });
      scoresCreated++;
    }
  }

  let winnersCreated = 0;
  if (options.includeWinners) {
    const winnerSeed = [
      { prizeKey: "grand", teamIndex: 0, notes: "Highest overall panel score." },
      { prizeKey: "best_ai", teamIndex: 1, notes: "Strongest AI architecture and model quality." },
      { prizeKey: "innovative_ai", teamIndex: 6, notes: "Highly creative LLM application." },
      { prizeKey: "climate_impact", teamIndex: 2, notes: "Most credible path to measurable emissions reduction." },
      { prizeKey: "climate_hardware", teamIndex: 3, notes: "Outstanding physical prototype." },
      { prizeKey: "best_fintech", teamIndex: 4, notes: "Excellent security and compliance implementation." },
      { prizeKey: "fintech_inclusivity", teamIndex: 5, notes: "Great potential for unbanked demographics." },
      { prizeKey: "sponsor_nebula", teamIndex: 14, notes: "Sponsor preferred strategy for commercialization." },
      { prizeKey: "sponsor_quantum", teamIndex: 15, notes: "Flawless integration of the GraphQL API." },
      { prizeKey: "fintech_atlas", teamIndex: 12, notes: "Best fintech execution with clear banking use case." },
      { prizeKey: "climate_greenops", teamIndex: 10, notes: "Innovative grid load balancing." },
      { prizeKey: "ai_synthdata", teamIndex: 8, notes: "Creative use of synthetic training sets." },
      { prizeKey: "best_design", teamIndex: 7, notes: "Exceptional UI/UX and polish." },
      { prizeKey: "best_pitch", teamIndex: 11, notes: "Most engaging and clear presentation." },
      { prizeKey: "community_choice", teamIndex: 13, notes: "Highest number of votes from attendees." }
    ];

    for (const winner of winnerSeed) {
      const prizeId = prizeIdsByKey.get(winner.prizeKey);
      const teamId = teamIds[winner.teamIndex];
      const submittedTeams = submissionsByPrize.get(winner.prizeKey) || [];
      if (!prizeId || !submittedTeams.includes(teamId)) continue;

      await ctx.db.insert("prizeWinners", {
        eventId,
        prizeId,
        teamId,
        placement: 1,
        notes: winner.notes,
        selectedAt: now,
        selectedBy: adminUserId,
      });
      winnersCreated++;
    }
  }

  return {
    eventId,
    teamsCreated: teamIds.length,
    judgesCreated: judgeIds.length,
    prizesCreated: prizeSeeds.length,
    submissionsCreated,
    scoresCreated,
    winnersCreated,
  };
}

export async function seedPrizeJudgingFlowDemoHandler(ctx: MutationCtx) {
  const result = await seedPrizeJudgingScenario(ctx, {
    name: "Prize Judging Demo - In Progress",
    lockScoring: false,
    includeWinners: false,
  });

  return {
    message:
      "Seeded prize judging demo (in-progress): event, teams, prizes, submissions, and judge scores.",
    eventId: result.eventId,
    teamsCreated: result.teamsCreated,
    judgesCreated: result.judgesCreated,
    prizesCreated: result.prizesCreated,
    submissionsCreated: result.submissionsCreated,
    scoresCreated: result.scoresCreated,
  };
}

export async function seedPrizeJudgingFlowLockedDemoHandler(ctx: MutationCtx) {
  const result = await seedPrizeJudgingScenario(ctx, {
    name: "Prize Judging Demo - Locked + Winners",
    lockScoring: true,
    includeWinners: true,
  });

  return {
    message: `Successfully created locked prize judging demo with winners. Generated ${result.teamsCreated} teams, ${result.judgesCreated} judges, ${result.prizesCreated} prizes, ${result.submissionsCreated} prize submissions, ${result.scoresCreated} scores, and ${result.winnersCreated} winners.`,
    eventId: result.eventId,
    teamsCreated: result.teamsCreated,
    judgesCreated: result.judgesCreated,
    prizesCreated: result.prizesCreated,
    submissionsCreated: result.submissionsCreated,
    scoresCreated: result.scoresCreated,
    winnersCreated: result.winnersCreated,
  };
}

export async function seedPrizeJudgingFlowCohortsDemoHandler(ctx: MutationCtx) {
  const customCategories = [
    { name: "Innovation", weight: 1.2 },
    { name: "Technical Depth", weight: 1.4 },
    { name: "Design", weight: 1.0 },
    { name: "Impact", weight: 1.3 },
    { name: "Viability", weight: 1.1 },
    { name: "Presentation", weight: 0.8, optOutAllowed: true },
  ];

  const result = await seedPrizeJudgingScenario(ctx, {
    name: "Prize Judging Demo - Cohorts (6 Categories)",
    lockScoring: false,
    includeWinners: false,
    enableCohorts: true,
    categories: customCategories,
  });

  return {
    message: `Successfully created prize judging demo with cohorts. Generated ${result.teamsCreated} teams, ${result.judgesCreated} judges, ${result.prizesCreated} prizes, ${result.submissionsCreated} prize submissions, and ${result.scoresCreated} scores.`,
    eventId: result.eventId,
    teamsCreated: result.teamsCreated,
    judgesCreated: result.judgesCreated,
    prizesCreated: result.prizesCreated,
    submissionsCreated: result.submissionsCreated,
    scoresCreated: result.scoresCreated,
    winnersCreated: result.winnersCreated,
  };
}
