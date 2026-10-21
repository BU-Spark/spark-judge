import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

let progressResult: unknown = undefined;
vi.mock("convex/react", () => ({
  useQueries: () => ({ progress: progressResult }),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: { judgeAssignments: { getJudgingProgress: "getJudgingProgress" } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { HackathonOverviewTab } from "../../../src/features/admin/tabs/HackathonOverviewTab";

const NOW = Date.now();
const teams = [
  { _id: "t1", name: "Alpha", track: "Health", githubUrl: "https://github.com/a/a", submittedBy: "u1" },
  { _id: "t2", name: "Beta", track: "Health", githubUrl: "https://github.com/b/b", submittedBy: "u2" },
  { _id: "t3", name: "Gamma", track: "Health", githubUrl: "https://github.com/c/c", submittedBy: "u3" },
  { _id: "t4", name: "Delta", track: "Health", githubUrl: "https://github.com/d/d", submittedBy: "u4" },
];
const score = (judgeId: string, teamId: string, totalScore: number) => ({
  judgeId,
  teamId,
  totalScore,
  submittedAt: NOW - 60_000,
});
const detailedScores = {
  teamRankings: [
    { team: teams[0], scores: [score("j1", "t1", 30), score("j2", "t1", 32), score("j3", "t1", 28)] },
    { team: teams[1], scores: [score("j1", "t2", 25)] },
    { team: teams[2], scores: [] },
    { team: teams[3], scores: [] },
  ],
  judgeBreakdown: [],
};

function renderOverview(overrides: Record<string, unknown> = {}) {
  const props = {
    event: {
      _id: "event1",
      name: "DS+X",
      judgeCode: "CODE",
      categories: [{ name: "Impact" }],
      enableCohorts: true,
      startDate: NOW - 3_600_000,
      endDate: NOW + 3_600_000,
      teams,
    },
    status: "active" as const,
    prizes: [{ _id: "p1", isActive: true }],
    detailedScores,
    locking: false,
    onNavigate: vi.fn(),
    onLockScoring: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<HackathonOverviewTab {...(props as any)} />);
  return props;
}

beforeEach(() => {
  progressResult = {
    requiresCode: true,
    cohortsEnabled: true,
    judges: [
      {
        judgeId: "j1",
        name: "Priya Nair",
        email: "priya@bu.edu",
        isAdmin: false,
        verified: true,
        claimedTeamIds: ["t1", "t2", "t3"],
        scoredTeamIds: ["t1", "t2"],
        lastScoredAt: NOW - 60_000,
        possibleConflictTeamIds: ["t3"],
      },
      {
        judgeId: "j2",
        name: "Ben Ortiz",
        isAdmin: false,
        verified: true,
        claimedTeamIds: ["t1", "t2"],
        scoredTeamIds: ["t1"],
        lastScoredAt: NOW - 30 * 60_000,
        possibleConflictTeamIds: [],
      },
      {
        judgeId: "j4",
        name: "New Judge",
        isAdmin: false,
        verified: false,
        claimedTeamIds: [],
        scoredTeamIds: [],
        possibleConflictTeamIds: [],
      },
    ],
  };
});

describe("HackathonOverviewTab", () => {
  it("lists unassigned teams, then teams waiting on named judges", () => {
    renderOverview();
    const section = screen.getByRole("heading", { name: "Missing scores" }).closest("section")!;
    expect(section).toHaveTextContent("1 team has no judges assigned · 2 scores outstanding");
    const rows = within(section).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual([
      "DeltaNo judges assigned",
      expect.stringContaining("BetaWaiting on Ben Ortiz1 of 2 assigned judges scored"),
      expect.stringContaining("GammaWaiting on Priya Nair0 of 1 assigned judges scored"),
    ]);
  });

  it("shows judge status, conflicts, and missing code entry", () => {
    renderOverview();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).getByText("Hasn't entered code")).toBeInTheDocument();
    expect(within(table).getByText("Listed on Gamma")).toBeInTheDocument();
  });

  it("summarizes open work before locking and locks on confirm", async () => {
    const props = renderOverview();
    fireEvent.click(screen.getByRole("button", { name: "Lock scoring" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveTextContent("2 assigned scores are still missing across 2 teams.");
    expect(dialog).toHaveTextContent("1 team has no judges assigned and no scores.");
    expect(dialog).toHaveTextContent("1 judge is listed on a team.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lock scoring", hidden: true }));
    await waitFor(() => expect(props.onLockScoring).toHaveBeenCalledTimes(1));
  });

  it("shows readiness blockers before the event and routes to the fix", () => {
    const props = renderOverview({
      status: "upcoming",
      prizes: [],
      detailedScores: { teamRankings: [], judgeBreakdown: [] },
    });
    expect(screen.getByText("Add at least one prize")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add prizes" }));
    expect(props.onNavigate).toHaveBeenCalledWith("prizes");
  });

  it("keeps working when the progress query is unavailable", () => {
    progressResult = new Error("Could not find public function");
    renderOverview();
    expect(screen.getByText(/Judge details couldn't load/)).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Missing scores" }).closest("section")!;
    expect(section).toHaveTextContent("2 teams have no scores.");
  });
});
