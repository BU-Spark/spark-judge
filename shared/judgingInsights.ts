/**
 * Pure judging analytics shared by the admin overview, live board, and scores.
 * Inputs are plain score records so the same math can run in tests, the
 * browser, and (later) Convex functions.
 */

export const ACTIVE_JUDGE_WINDOW_MS = 15 * 60 * 1000;

export type ScoreRecord = {
  judgeId: string;
  teamId: string;
  totalScore: number;
  submittedAt?: number;
};

export type InsightTeam = {
  _id: string;
  name: string;
  hidden?: boolean;
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length,
  );
}

export type NormalizedTeamScore = {
  /** Mean z-score across the judges who could be normalized. */
  value: number | null;
  contributingJudges: number;
};

/**
 * Converts every judge's totals to z-scores against that judge's own mean and
 * spread, then averages per team. A judge who scored a single team has no
 * spread to compare against and is left out. A judge who gave every team the
 * same total contributes 0 for each of those teams.
 */
export function normalizeByJudge(
  scores: ScoreRecord[],
): Map<string, NormalizedTeamScore> {
  const totalsByJudge = new Map<string, number[]>();
  for (const score of scores) {
    const totals = totalsByJudge.get(score.judgeId) ?? [];
    totals.push(score.totalScore);
    totalsByJudge.set(score.judgeId, totals);
  }

  const zByTeam = new Map<string, number[]>();
  const teamIds = new Set<string>();
  for (const score of scores) {
    teamIds.add(score.teamId);
    const totals = totalsByJudge.get(score.judgeId)!;
    if (totals.length < 2) continue;
    const spread = standardDeviation(totals);
    const z = spread === 0 ? 0 : (score.totalScore - mean(totals)) / spread;
    const values = zByTeam.get(score.teamId) ?? [];
    values.push(z);
    zByTeam.set(score.teamId, values);
  }

  const result = new Map<string, NormalizedTeamScore>();
  for (const teamId of teamIds) {
    const values = zByTeam.get(teamId) ?? [];
    result.set(teamId, {
      value: values.length > 0 ? mean(values) : null,
      contributingJudges: values.length,
    });
  }
  return result;
}

/**
 * Competition ranking ("1, 2, 2, 4"). Values are compared at the displayed
 * precision so rows that look tied share a rank. Null values are unranked.
 */
export function rankByValue(
  rows: Array<{ id: string; value: number | null }>,
  precision = 2,
): Map<string, number> {
  const factor = 10 ** precision;
  const ranked = rows
    .filter((row) => row.value !== null && Number.isFinite(row.value))
    .map((row) => ({ id: row.id, key: Math.round(row.value! * factor) }))
    .sort((a, b) => b.key - a.key);
  const ranks = new Map<string, number>();
  ranked.forEach((row, index) => {
    const rank =
      index > 0 && row.key === ranked[index - 1].key
        ? ranks.get(ranked[index - 1].id)!
        : index + 1;
    ranks.set(row.id, rank);
  });
  return ranks;
}

/** Ids whose rank is shared with at least one other row. */
export function findTiedIds(ranks: Map<string, number>): Set<string> {
  const counts = new Map<number, number>();
  for (const rank of ranks.values()) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return new Set(
    [...ranks.entries()]
      .filter(([, rank]) => (counts.get(rank) ?? 0) > 1)
      .map(([id]) => id),
  );
}

export type JudgeLeniency = {
  judgeId: string;
  count: number;
  mean: number;
  spread: number;
  /** Judge mean minus the mean of every scorecard in the event. */
  offset: number;
};

export function judgeLeniency(scores: ScoreRecord[]): JudgeLeniency[] {
  if (scores.length === 0) return [];
  const eventMean = mean(scores.map((score) => score.totalScore));
  const totalsByJudge = new Map<string, number[]>();
  for (const score of scores) {
    const totals = totalsByJudge.get(score.judgeId) ?? [];
    totals.push(score.totalScore);
    totalsByJudge.set(score.judgeId, totals);
  }
  return [...totalsByJudge.entries()]
    .map(([judgeId, totals]) => {
      const judgeMean = mean(totals);
      return {
        judgeId,
        count: totals.length,
        mean: judgeMean,
        spread: standardDeviation(totals),
        offset: judgeMean - eventMean,
      };
    })
    .sort((a, b) => b.offset - a.offset);
}

export type JudgeActivityStatus =
  | "awaiting_code"
  | "not_started"
  | "active"
  | "idle"
  | "done";

export function judgeActivityStatus(
  judge: {
    verified: boolean;
    claimedCount: number;
    scoredCount: number;
    lastScoredAt?: number;
    cohortsEnabled: boolean;
  },
  now: number,
): JudgeActivityStatus {
  if (!judge.verified) return "awaiting_code";
  if (judge.scoredCount === 0) return "not_started";
  if (
    judge.cohortsEnabled &&
    judge.claimedCount > 0 &&
    judge.scoredCount >= judge.claimedCount
  ) {
    return "done";
  }
  if (
    judge.lastScoredAt !== undefined &&
    now - judge.lastScoredAt <= ACTIVE_JUDGE_WINDOW_MS
  ) {
    return "active";
  }
  return "idle";
}

export type AssignmentJudge = {
  judgeId: string;
  name: string;
  claimedTeamIds: string[];
  scoredTeamIds: string[];
};

export type AssignmentStatus = "unassigned" | "waiting" | "complete";

export type TeamAssignmentProgress = {
  teamId: string;
  name: string;
  status: AssignmentStatus;
  assigned: string[];
  /** Assigned judges who haven't submitted a score for this team. */
  waitingOn: string[];
  scoredCount: number;
};

/**
 * Cohort judging: each judge scores the teams assigned to them. A team is
 * complete when every assigned judge has submitted, and flagged when no judge
 * has it at all. Scores from judges outside the assignment still count.
 */
export function computeAssignmentProgress(
  teams: InsightTeam[],
  judges: AssignmentJudge[],
): TeamAssignmentProgress[] {
  const order: Record<AssignmentStatus, number> = {
    unassigned: 0,
    waiting: 1,
    complete: 2,
  };
  return teams
    .filter((team) => !team.hidden)
    .map((team) => {
      const teamId = String(team._id);
      const assignedJudges = judges.filter((judge) =>
        judge.claimedTeamIds.map(String).includes(teamId),
      );
      const scoredCount = judges.filter((judge) =>
        judge.scoredTeamIds.map(String).includes(teamId),
      ).length;
      const waitingOn = assignedJudges
        .filter((judge) => !judge.scoredTeamIds.map(String).includes(teamId))
        .map((judge) => judge.name);
      const status: AssignmentStatus =
        assignedJudges.length === 0 && scoredCount === 0
          ? "unassigned"
          : waitingOn.length > 0
            ? "waiting"
            : "complete";
      return {
        teamId,
        name: team.name,
        status,
        assigned: assignedJudges.map((judge) => judge.name),
        waitingOn,
        scoredCount,
      };
    })
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        b.waitingOn.length - a.waitingOn.length ||
        a.name.localeCompare(b.name),
    );
}

/** Median judges per scored team; teams well below it are thinly judged. */
export function typicalJudgeCount(judgeCounts: number[]) {
  const scored = judgeCounts.filter((count) => count > 0).sort((a, b) => a - b);
  if (scored.length === 0) return 0;
  const middle = Math.floor(scored.length / 2);
  return scored.length % 2
    ? scored[middle]
    : Math.round((scored[middle - 1] + scored[middle]) / 2);
}

export type CategoryScoreEntry = {
  category: string;
  score: number | null;
  optedOut?: boolean;
};

/** Mirrors the server's total: weighted mean of answered categories, scaled by the
 * included weight. Returns null when the judge answered none of the included categories. */
export function scorecardTotal(
  categoryScores: readonly CategoryScoreEntry[],
  categories: ReadonlyArray<{ name: string; weight?: number }>,
): number | null {
  const weights = new Map(categories.map((category) => [category.name, category.weight ?? 1]));
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  let weightedSum = 0;
  let usedWeight = 0;
  for (const entry of categoryScores) {
    const weight = weights.get(entry.category);
    if (weight === undefined || entry.optedOut || typeof entry.score !== "number") continue;
    weightedSum += entry.score * weight;
    usedWeight += weight;
  }
  if (usedWeight === 0 || totalWeight === 0) return null;
  return (weightedSum / usedWeight) * totalWeight;
}
