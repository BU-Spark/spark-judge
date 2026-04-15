import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { computeEventStatus, isAdmin, requireAdmin } from "./helpers";
import { isCodeAndTellMode } from "./eventModes";

export const MAX_RANKED_CHOICES = 5;

type VisibleTeam = Doc<"teams">;

function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function getVisibleTeams(eventTeams: Doc<"teams">[]) {
  return eventTeams.filter((team) => !team.hidden);
}

function getOwnedTeamIdsForEmail(teams: VisibleTeam[], email: string | null) {
  if (!email) return new Set<Id<"teams">>();

  return new Set(
    teams
      .filter((team) => (team.entrantEmails || []).includes(email))
      .map((team) => team._id)
  );
}

export function getRequiredRankCount(eligibleTeamCount: number) {
  return Math.min(MAX_RANKED_CHOICES, eligibleTeamCount);
}

export function sanitizeBallotTeamIds(
  rankedTeamIds: Id<"teams">[],
  visibleTeamIds: Set<Id<"teams">>
) {
  const seen = new Set<Id<"teams">>();
  const sanitized: Id<"teams">[] = [];

  for (const teamId of rankedTeamIds) {
    if (!visibleTeamIds.has(teamId) || seen.has(teamId)) continue;
    seen.add(teamId);
    sanitized.push(teamId);
  }

  return sanitized;
}

export function validateRankedBallot({
  rankedTeamIds,
  visibleTeamIds,
  ownProjectIds,
  requiredRankCount,
}: {
  rankedTeamIds: Id<"teams">[];
  visibleTeamIds: Set<Id<"teams">>;
  ownProjectIds: Set<Id<"teams">>;
  requiredRankCount: number;
}) {
  const uniqueRankedTeamIds = sanitizeBallotTeamIds(
    rankedTeamIds,
    visibleTeamIds
  );

  if (uniqueRankedTeamIds.length !== rankedTeamIds.length) {
    throw new Error("Ballots cannot include duplicate or unavailable projects");
  }

  if (uniqueRankedTeamIds.some((teamId) => ownProjectIds.has(teamId))) {
    throw new Error("You cannot rank a project associated with your email");
  }

  if (uniqueRankedTeamIds.length !== requiredRankCount) {
    throw new Error(
      `Ballots must rank exactly ${requiredRankCount} project${
        requiredRankCount === 1 ? "" : "s"
      }`
    );
  }

  return uniqueRankedTeamIds;
}

async function getEventAndVisibleTeams(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">
) {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found");
  }
  if (!isCodeAndTellMode(event.mode)) {
    throw new Error("Code & Tell voting is only available for Code & Tell events");
  }

  const teams = getVisibleTeams(
    await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect()
  );

  return { event, teams };
}

type StandingRow = {
  teamId: Id<"teams">;
  name: string;
  description: string;
  projectUrl?: string;
  points: number;
  ballotsCount: number;
  rankCounts: number[];
};

type StandingTeamInput = {
  _id: Id<"teams">;
  name: string;
  description: string;
  projectUrl?: string;
  githubUrl?: string;
};

export function computeCodeAndTellStandings(
  teams: StandingTeamInput[],
  ballots: Id<"teams">[][]
) {
  const visibleTeamIds = new Set(teams.map((team) => team._id));
  const standings = new Map<Id<"teams">, StandingRow>();

  for (const team of teams) {
    standings.set(team._id, {
      teamId: team._id,
      name: team.name,
      description: team.description,
      projectUrl: team.projectUrl || team.githubUrl || undefined,
      points: 0,
      ballotsCount: 0,
      rankCounts: Array.from({ length: MAX_RANKED_CHOICES }, () => 0),
    });
  }

  let validBallots = 0;

  for (const ballot of ballots) {
    const sanitizedIds = sanitizeBallotTeamIds(ballot, visibleTeamIds);
    if (sanitizedIds.length === 0) continue;

    validBallots += 1;
    const ballotSize = sanitizedIds.length;
    sanitizedIds.forEach((teamId, index) => {
      const row = standings.get(teamId);
      if (!row) return;
      row.points += ballotSize - index;
      row.ballotsCount += 1;
      row.rankCounts[index] += 1;
    });
  }

  const sorted = Array.from(standings.values()).sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    for (let index = 0; index < MAX_RANKED_CHOICES; index += 1) {
      if (right.rankCounts[index] !== left.rankCounts[index]) {
        return right.rankCounts[index] - left.rankCounts[index];
      }
    }
    return left.name.localeCompare(right.name);
  });

  return {
    totalBallots: validBallots,
    standings: sorted,
    defaultWinnerId: sorted[0]?.teamId,
  };
}

async function buildStandings(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">
) {
  const { event, teams } = await getEventAndVisibleTeams(ctx, eventId);
  const votes = await ctx.db
    .query("rankedVotes")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
  const { totalBallots, standings, defaultWinnerId } =
    computeCodeAndTellStandings(
      teams,
      votes.map((vote) => vote.rankedTeamIds)
    );

  return {
    event,
    teams,
    totalBallots,
    rankedVoteRowCount: votes.length,
    standings,
    defaultWinnerId,
  };
}

export const getVotingContext = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      myEmail: v.string(),
      ownProjectIds: v.array(v.id("teams")),
      requiredRankCount: v.number(),
      eligibleProjectCount: v.number(),
      currentBallotTeamIds: v.array(v.id("teams")),
      maxBallots: v.union(v.number(), v.null()),
      rankedVoteRowCount: v.number(),
      hasSubmittedBallot: v.boolean(),
      votingClosedToNewVoters: v.boolean(),
      projects: v.array(
        v.object({
          _id: v.id("teams"),
          name: v.string(),
          description: v.string(),
          members: v.array(v.string()),
          projectUrl: v.optional(v.string()),
          entrantEmails: v.array(v.string()),
          isOwned: v.boolean(),
          isEligible: v.boolean(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const myEmail = normalizeEmail(user?.email);
    if (!myEmail) {
      throw new Error("A verified account email is required to vote");
    }

    const { event, teams } = await getEventAndVisibleTeams(ctx, args.eventId);
    const ownProjectIds = Array.from(getOwnedTeamIdsForEmail(teams, myEmail));
    const currentBallot = await ctx.db
      .query("rankedVotes")
      .withIndex("by_event_and_voter", (q) =>
        q.eq("eventId", args.eventId).eq("voterUserId", userId)
      )
      .first();

    const rankedVoteRows = await ctx.db
      .query("rankedVotes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const rankedVoteRowCount = rankedVoteRows.length;
    const maxBallots =
      typeof event.codeAndTellMaxBallots === "number"
        ? event.codeAndTellMaxBallots
        : null;
    const hasSubmittedBallot = !!currentBallot;
    const votingClosedToNewVoters =
      maxBallots !== null &&
      rankedVoteRowCount >= maxBallots &&
      !hasSubmittedBallot;

    const eligibleProjectCount = teams.filter(
      (team) => !ownProjectIds.includes(team._id)
    ).length;

    return {
      myEmail,
      ownProjectIds,
      requiredRankCount: getRequiredRankCount(eligibleProjectCount),
      eligibleProjectCount,
      currentBallotTeamIds: currentBallot?.rankedTeamIds || [],
      maxBallots,
      rankedVoteRowCount,
      hasSubmittedBallot,
      votingClosedToNewVoters,
      projects: teams
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((team) => {
          const isOwned = ownProjectIds.includes(team._id);
          return {
            _id: team._id,
            name: team.name,
            description: team.description,
            members: team.members,
            projectUrl: team.projectUrl || team.githubUrl || undefined,
            entrantEmails: team.entrantEmails || [],
            isOwned,
            isEligible: !isOwned,
          };
        }),
    };
  },
});

export const getMyBallot = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.id("teams")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event || !isCodeAndTellMode(event.mode)) return [];

    const vote = await ctx.db
      .query("rankedVotes")
      .withIndex("by_event_and_voter", (q) =>
        q.eq("eventId", args.eventId).eq("voterUserId", userId)
      )
      .first();

    return vote?.rankedTeamIds || [];
  },
});

export const saveBallot = mutation({
  args: {
    eventId: v.id("events"),
    rankedTeamIds: v.array(v.id("teams")),
  },
  returns: v.id("rankedVotes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const userEmail = normalizeEmail(user?.email);
    if (!userEmail) {
      throw new Error("A verified account email is required to vote");
    }

    const { event, teams } = await getEventAndVisibleTeams(ctx, args.eventId);
    if (computeEventStatus(event) !== "active") {
      throw new Error("Ballots can only be edited while the event is active");
    }

    const visibleTeamIds = new Set(teams.map((team) => team._id));
    const ownProjectIds = getOwnedTeamIdsForEmail(teams, userEmail);
    const eligibleTeamIds = teams
      .map((team) => team._id)
      .filter((teamId) => !ownProjectIds.has(teamId));
    const requiredRankCount = getRequiredRankCount(eligibleTeamIds.length);

    const uniqueRankedTeamIds = validateRankedBallot({
      rankedTeamIds: args.rankedTeamIds,
      visibleTeamIds,
      ownProjectIds,
      requiredRankCount,
    });

    const existingVote = await ctx.db
      .query("rankedVotes")
      .withIndex("by_event_and_voter", (q) =>
        q.eq("eventId", args.eventId).eq("voterUserId", userId)
      )
      .first();

    const maxBallots = event.codeAndTellMaxBallots;
    if (!existingVote && typeof maxBallots === "number") {
      const rows = await ctx.db
        .query("rankedVotes")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect();
      if (rows.length >= maxBallots) {
        throw new Error("This event has reached its voting limit.");
      }
    }

    const now = Date.now();
    if (existingVote) {
      await ctx.db.patch(existingVote._id, {
        rankedTeamIds: uniqueRankedTeamIds,
        updatedAt: now,
      });
      return existingVote._id;
    }

    return await ctx.db.insert("rankedVotes", {
      eventId: args.eventId,
      voterUserId: userId,
      rankedTeamIds: uniqueRankedTeamIds,
      submittedAt: now,
      updatedAt: now,
    });
  },
});

export const getAdminSummary = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      totalBallots: v.number(),
      rankedVoteRowCount: v.number(),
      maxBallots: v.union(v.number(), v.null()),
      ballotsRemaining: v.union(v.number(), v.null()),
      defaultWinnerId: v.union(v.id("teams"), v.null()),
      selectedWinnerId: v.union(v.id("teams"), v.null()),
      standings: v.array(
        v.object({
          teamId: v.id("teams"),
          name: v.string(),
          description: v.string(),
          projectUrl: v.optional(v.string()),
          points: v.number(),
          ballotsCount: v.number(),
          rankCounts: v.array(v.number()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) return null;

    const summary = await buildStandings(ctx, args.eventId);
    const max =
      typeof summary.event.codeAndTellMaxBallots === "number"
        ? summary.event.codeAndTellMaxBallots
        : null;
    const ballotsRemaining =
      max === null ? null : Math.max(0, max - summary.rankedVoteRowCount);
    return {
      totalBallots: summary.totalBallots,
      rankedVoteRowCount: summary.rankedVoteRowCount,
      maxBallots: max,
      ballotsRemaining,
      defaultWinnerId: summary.defaultWinnerId ?? null,
      selectedWinnerId: summary.event.overallWinner ?? null,
      standings: summary.standings,
    };
  },
});

export const setWinner = mutation({
  args: {
    eventId: v.id("events"),
    winnerTeamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const summary = await buildStandings(ctx, args.eventId);
    if (computeEventStatus(summary.event) !== "past") {
      throw new Error("The event must be past before selecting a winner");
    }

    if (!summary.standings.some((row) => row.teamId === args.winnerTeamId)) {
      throw new Error("Winner must be a visible project in this event");
    }

    await ctx.db.patch(args.eventId, {
      overallWinner: args.winnerTeamId,
      categoryWinners: [],
    });
    return null;
  },
});

export const releaseResults = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (!isCodeAndTellMode(event.mode)) {
      throw new Error("Code & Tell release is only available for Code & Tell events");
    }
    if (computeEventStatus(event) !== "past") {
      throw new Error("The event must be past before releasing results");
    }
    if (!event.overallWinner) {
      throw new Error("Select a winner before releasing results");
    }

    const visibleTeams = getVisibleTeams(
      await ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect()
    );
    if (!visibleTeams.some((team) => team._id === event.overallWinner)) {
      throw new Error("Selected winner is no longer available");
    }

    await ctx.db.patch(args.eventId, {
      resultsReleased: true,
      categoryWinners: [],
    });
    return null;
  },
});

export const getPublicResults = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      winnerTeamId: v.union(v.id("teams"), v.null()),
      totalBallots: v.number(),
      standings: v.array(
        v.object({
          teamId: v.id("teams"),
          name: v.string(),
          description: v.string(),
          projectUrl: v.optional(v.string()),
          points: v.number(),
          ballotsCount: v.number(),
          rankCounts: v.array(v.number()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || !isCodeAndTellMode(event.mode) || !event.resultsReleased) {
      return null;
    }

    const summary = await buildStandings(ctx, args.eventId);
    return {
      winnerTeamId: summary.event.overallWinner ?? summary.defaultWinnerId ?? null,
      totalBallots: summary.totalBallots,
      standings: summary.standings.slice(0, 5),
    };
  },
});
