import { describe, expect, it } from "vitest";
import {
  findTiedIds,
  judgeActivityStatus,
  judgeLeniency,
  normalizeByJudge,
  rankByValue,
  ACTIVE_JUDGE_WINDOW_MS,
  scorecardTotal,
} from "../../../shared/judgingInsights";
import {
  findSimilarTeamNames,
  getHackathonReadiness,
  summarizeReadiness,
} from "../../../shared/hackathonReadiness";
import { findPossibleConflicts } from "../../../convex/judgeAssignments";

const score = (judgeId: string, teamId: string, totalScore: number) => ({
  judgeId,
  teamId,
  totalScore,
});

describe("normalizeByJudge", () => {
  it("removes a harsh judge's bias so equal relative opinions tie", () => {
    // Lenient judge rates A over B by the same margin a harsh judge does.
    const normalized = normalizeByJudge([
      score("lenient", "a", 38),
      score("lenient", "b", 34),
      score("harsh", "a", 22),
      score("harsh", "b", 18),
    ]);
    expect(normalized.get("a")!.value).toBeCloseTo(1);
    expect(normalized.get("b")!.value).toBeCloseTo(-1);
  });

  it("does not let one generous judge carry a team they alone scored", () => {
    const raw = [
      score("j1", "solo", 40), // only judge for "solo", gave many teams 40
      score("j1", "x", 40),
      score("j1", "y", 40),
      score("j2", "x", 30),
      score("j2", "y", 20),
    ];
    const normalized = normalizeByJudge(raw);
    // j1 gave identical totals, so their scores are neutral (0).
    expect(normalized.get("solo")!.value).toBe(0);
    expect(normalized.get("x")!.value).toBeGreaterThan(normalized.get("y")!.value!);
  });

  it("leaves out judges who scored a single team", () => {
    const normalized = normalizeByJudge([score("once", "a", 40)]);
    expect(normalized.get("a")).toEqual({ value: null, contributingJudges: 0 });
  });
});

describe("ranking helpers", () => {
  it("shares ranks for values that match at display precision", () => {
    const ranks = rankByValue([
      { id: "a", value: 33.454 },
      { id: "b", value: 33.451 },
      { id: "c", value: 35 },
      { id: "d", value: null },
    ]);
    expect(Object.fromEntries(ranks)).toEqual({ c: 1, a: 2, b: 2 });
    expect([...findTiedIds(ranks)].sort()).toEqual(["a", "b"]);
  });
});

describe("judgeLeniency", () => {
  it("reports each judge's offset from the event mean", () => {
    const rows = judgeLeniency([
      score("kind", "a", 36),
      score("kind", "b", 34),
      score("tough", "a", 20),
      score("tough", "b", 22),
    ]);
    expect(rows[0]).toMatchObject({ judgeId: "kind", count: 2, mean: 35, offset: 7 });
    expect(rows[1]).toMatchObject({ judgeId: "tough", offset: -7 });
  });
});

describe("judgeActivityStatus", () => {
  const now = 1_000_000_000;
  const base = { verified: true, claimedCount: 0, scoredCount: 0, cohortsEnabled: true };
  it("separates waiting, active, idle, and done judges", () => {
    expect(judgeActivityStatus({ ...base, verified: false }, now)).toBe("awaiting_code");
    expect(judgeActivityStatus(base, now)).toBe("not_started");
    expect(judgeActivityStatus({ ...base, claimedCount: 4, scoredCount: 2, lastScoredAt: now - 60_000 }, now)).toBe("active");
    expect(
      judgeActivityStatus({ ...base, claimedCount: 4, scoredCount: 2, lastScoredAt: now - ACTIVE_JUDGE_WINDOW_MS - 1 }, now),
    ).toBe("idle");
    expect(judgeActivityStatus({ ...base, claimedCount: 2, scoredCount: 2, lastScoredAt: now }, now)).toBe("done");
  });
});

describe("hackathon readiness", () => {
  const ready = {
    judgeCode: "CODE",
    categoryCount: 4,
    activePrizeCount: 2,
    teams: [{ _id: "t", name: "Team", track: "Health", githubUrl: "https://github.com/x/y", submittedBy: "u" }],
    judgesRegistered: 3,
    eventStatus: "upcoming" as const,
    startDate: 0,
    endDate: 1,
  };

  it("passes a configured event", () => {
    expect(summarizeReadiness(getHackathonReadiness(ready))).toEqual({ blockers: 0, warnings: 0 });
  });

  it("blocks on a missing judge code, rubric, or prize", () => {
    const checks = getHackathonReadiness({ ...ready, judgeCode: " ", categoryCount: 0, activePrizeCount: 0 });
    expect(checks.filter((check) => check.status === "fail").map((check) => check.id)).toEqual([
      "judge-code",
      "rubric",
      "prizes",
    ]);
  });

  it("warns about admin-added, duplicate, and incomplete teams", () => {
    const checks = getHackathonReadiness({
      ...ready,
      teams: [
        { _id: "1", name: "City Megaminds", submittedBy: "u1", track: "Civic" },
        { _id: "2", name: "City Megamind", track: "Civic", githubUrl: "https://github.com/a/b" },
      ],
    });
    const ids = checks.filter((check) => check.status === "warn").map((check) => check.id);
    expect(ids).toEqual(["admin-teams", "duplicate-teams", "repos"]);
  });

  it("treats having no judges as a blocker only once the event is live", () => {
    const upcoming = getHackathonReadiness({ ...ready, judgesRegistered: 0 });
    const live = getHackathonReadiness({ ...ready, judgesRegistered: 0, eventStatus: "active" });
    const unknown = getHackathonReadiness({ ...ready, judgesRegistered: null });
    expect(upcoming.find((check) => check.id === "judges")!.status).toBe("warn");
    expect(live.find((check) => check.id === "judges")!.status).toBe("fail");
    expect(unknown.find((check) => check.id === "judges")).toBeUndefined();
  });

  it("ignores hidden teams and short names when looking for duplicates", () => {
    expect(
      findSimilarTeamNames([
        { _id: "1", name: "Foodies" },
        { _id: "2", name: "Foodie", hidden: true },
        { _id: "3", name: "AB" },
        { _id: "4", name: "AC" },
      ]),
    ).toEqual([]);
  });
});

describe("findPossibleConflicts", () => {
  it("matches a judge to teams that list them or that they submitted", () => {
    const teams = [
      { _id: "listed", members: ["Priya Nair", "Dan"] },
      { _id: "email", members: ["sam@bu.edu"] },
      { _id: "submitted", members: [], submittedBy: "user-1" },
      { _id: "other", members: ["Someone Else"] },
    ];
    expect(
      findPossibleConflicts({ userId: "user-1", name: "priya  nair", email: "sam@bu.edu" }, teams),
    ).toEqual(["listed", "email", "submitted"]);
  });
});

import {
  computeAssignmentProgress,
  typicalJudgeCount,
} from "../../../shared/judgingInsights";

describe("computeAssignmentProgress", () => {
  it("lists unassigned teams first, then teams waiting on judges", () => {
    const progress = computeAssignmentProgress(
      [
        { _id: "a", name: "Alpha" },
        { _id: "b", name: "Beta" },
        { _id: "c", name: "Gamma" },
        { _id: "h", name: "Hidden", hidden: true },
      ],
      [
        { judgeId: "j1", name: "Ana", claimedTeamIds: ["a", "b"], scoredTeamIds: ["a", "b"] },
        { judgeId: "j2", name: "Ben", claimedTeamIds: ["a", "b"], scoredTeamIds: ["a"] },
      ],
    );
    expect(progress.map((row) => [row.name, row.status, row.waitingOn])).toEqual([
      ["Gamma", "unassigned", []],
      ["Beta", "waiting", ["Ben"]],
      ["Alpha", "complete", []],
    ]);
  });
});

describe("typicalJudgeCount", () => {
  it("uses the median of scored teams", () => {
    expect(typicalJudgeCount([0, 4, 5, 5, 1])).toBe(5);
    expect(typicalJudgeCount([2, 4])).toBe(3);
    expect(typicalJudgeCount([0])).toBe(0);
  });
});

describe("scorecardTotal", () => {
  const entries = [
    { category: "Impact", score: 4 },
    { category: "Technical", score: 2 },
    { category: "Design", score: null, optedOut: true },
  ];
  it("matches the server formula for the included categories", () => {
    expect(scorecardTotal(entries, [{ name: "Impact", weight: 2 }, { name: "Technical", weight: 1 }])).toBeCloseTo(10);
    expect(scorecardTotal(entries, [{ name: "Impact" }])).toBe(4);
  });
  it("keeps opt-outs neutral and returns null when nothing counted", () => {
    expect(scorecardTotal(entries, [{ name: "Impact" }, { name: "Design" }])).toBe(8);
    expect(scorecardTotal(entries, [{ name: "Design" }])).toBeNull();
  });
});
