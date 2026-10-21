import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ScoringDashboard } from "../../../src/features/admin/components/ScoringDashboard";

const categories = ["Impact", "Technical"];
const card = (judgeId: string, teamId: string, impact: number, technical: number) => ({
  _id: `${judgeId}-${teamId}`,
  judgeId,
  teamId,
  totalScore: impact + technical,
  categoryScores: [
    { category: "Impact", score: impact },
    { category: "Technical", score: technical },
  ],
});
const row = (id: string, name: string, track: string, cards: ReturnType<typeof card>[]) => ({
  team: { _id: id, name, track },
  averageScore: cards.reduce((sum, c) => sum + c.totalScore, 0) / cards.length,
  judgeCount: cards.length,
  categoryAverages: {},
  scores: cards,
});

// Technical-heavy Alpha wins overall; impact-heavy Beta wins without Technical.
const scores = {
  teamRankings: [
    row("a", "Alpha", "Health", [card("j1", "a", 2, 5), card("j2", "a", 2, 5)]),
    row("b", "Beta", "Health", [card("j1", "b", 4, 2), card("j2", "b", 4, 2)]),
    row("c", "Gamma", "Climate", [card("j1", "c", 3, 3), card("j2", "c", 3, 3)]),
  ],
  categoryRankings: {},
  judgeBreakdown: [],
  categories,
  categoryRubric: categories.map((name) => ({ name, weight: 1, percent: 50, maxPoints: 5 })),
};
const prizeFilters = [
  { id: "fh", name: "FirstHacks", teamIds: ["a", "b"], categoryNames: [] },
  { id: "imp", name: "Impact Award", teamIds: ["a", "b", "c"], categoryNames: ["Impact"] },
];

function renderDashboard() {
  render(
    <ScoringDashboard
      scores={scores}
      prizeFilters={prizeFilters}
      viewMode="table"
      setViewMode={() => {}}
    />,
  );
}

const rankedNames = () =>
  within(screen.getAllByRole("table")[0])
    .getAllByRole("row")
    .slice(1)
    .map((tr) => within(tr).getAllByRole("cell").slice(0, 2).map((td) => td.textContent).join(" "));

describe("ScoringDashboard filters", () => {
  it("limits rows to a prize's entrants and ranks within them", () => {
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "prize:fh" } });
    expect(rankedNames()).toEqual(["#1 Alpha", "#2 Beta"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 of 3 teams in FirstHacks");
  });

  it("recomputes totals and ranks when a category is removed", () => {
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "prize:fh" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Technical" }));
    expect(rankedNames()).toEqual(["#1 Beta", "#2 Alpha"]);
    expect(screen.getByRole("button", { name: /Avg \/ 5/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Technical/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 categories");
  });

  it("applies a prize's own category set and keeps one category counted", () => {
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "prize:imp" } });
    expect(screen.getByRole("checkbox", { name: "Technical" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Impact" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("(set by this prize)");
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "all" } });
    expect(screen.getByRole("checkbox", { name: "Technical" })).toBeChecked();
  });

  it("filters by track and resets", () => {
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "track:Climate" } });
    expect(rankedNames()).toEqual(["#1 Gamma"]);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(rankedNames()).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
