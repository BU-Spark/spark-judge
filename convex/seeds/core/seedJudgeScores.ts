import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";

export async function seedJudgeScoresHandler(ctx: MutationCtx) {
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
        const categoryScores = event.categories.map((catObj) => ({
          category: catObj.name,
          // Random scores between 1-5, with a bias toward 3-4
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
}
