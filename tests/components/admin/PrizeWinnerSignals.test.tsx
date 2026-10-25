import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PrizeWinnerWizardPanel } from "../../../src/features/admin/panels/PrizeWinnerWizardPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const rubric = [
  { name: "Design", weight: 0.9 },
  { name: "Presentation", weight: 0.3 },
  { name: "Technical", weight: 1.5 },
];
const categoryScores = (
  design: number | null,
  presentation: number | null,
  technical: number,
) => [
  { category: "Design", score: design, optedOut: design === null },
  {
    category: "Presentation",
    score: presentation,
    optedOut: presentation === null,
  },
  { category: "Technical", score: technical },
];
const candidates = [
  { teamId: "a" as any, teamName: "Alpha", averageScore: 9.9, judgeCount: 2 },
  { teamId: "b" as any, teamName: "Beta", averageScore: 7.2, judgeCount: 2 },
  { teamId: "c" as any, teamName: "Gamma", averageScore: 13.5, judgeCount: 1 },
];
const details = {
  categories: rubric.map((c) => c.name),
  categoryRubric: rubric,
  teamRankings: [
    {
      team: { _id: "a" },
      categoryAverages: { Design: 2, Presentation: 2, Technical: 5 },
      scores: [
        { categoryScores: categoryScores(2, 2, 5) },
        { categoryScores: categoryScores(2, 2, 5) },
      ],
    },
    {
      team: { _id: "b" },
      categoryAverages: { Design: 5, Presentation: 4, Technical: 1 },
      scores: [
        { categoryScores: categoryScores(5, 4, 1) },
        { categoryScores: categoryScores(5, 4, 1) },
      ],
    },
    {
      team: { _id: "c" },
      categoryAverages: { Design: 0, Presentation: 0, Technical: 5 },
      scores: [{ categoryScores: categoryScores(null, null, 5) }],
    },
  ],
};
const prizes = [
  {
    prize: {
      _id: "figma" as any,
      name: "Figma",
      scoreBasis: "categories" as const,
      scoreCategoryNames: ["Design", "Presentation"],
    },
    candidates,
  },
  {
    prize: {
      _id: "overall" as any,
      name: "Overall",
      scoreBasis: "overall" as const,
    },
    candidates,
  },
  {
    prize: {
      _id: "manual" as any,
      name: "Manual award",
      scoreBasis: "none" as const,
    },
    candidates,
  },
];
function panel(detailedScores = details) {
  render(
    <PrizeWinnerWizardPanel
      eventId={"event" as any}
      deliberationData={{ prizes }}
      detailedScores={detailedScores}
      existingWinners={[]}
      onSubmit={vi.fn()}
      onClose={() => {}}
    />,
  );
}
const rows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);
const names = () =>
  rows().map((row) =>
    within(row).getByRole("radio").getAttribute("aria-label"),
  );

describe("prize skill signals in winner selection", () => {
  it("totals the prize categories out of their combined maximum and keeps the weighted overall score separate", () => {
    panel();
    expect(
      screen.getByText(/Prize categories:/).closest("p"),
    ).toHaveTextContent("Design · Presentation");
    expect(
      screen.getByRole("columnheader", { name: "Prize score / 10" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Overall score / 13.5" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Technical" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Minimum Technical"),
    ).not.toBeInTheDocument();
    expect(names()).toEqual(["Choose Beta", "Choose Alpha", "Choose Gamma"]);
    expect(within(rows()[0]).getAllByRole("cell")[2]).toHaveTextContent("9.00");
    expect(within(rows()[0]).getAllByRole("cell")[3]).toHaveTextContent("7.20");
    expect(within(rows()[1]).getAllByRole("cell")[2]).toHaveTextContent("4.00");
    expect(
      within(rows()[2]).getByText("Unscored for this prize"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum prize score / 10")).toHaveAttribute(
      "max",
      "10",
    );
    fireEvent.change(screen.getByLabelText("Minimum prize score / 10"), {
      target: { value: "8" },
    });
    expect(names()).toEqual(["Choose Beta"]);
  });

  it("reuses rubric opt-out normalization and counts only judges who scored a signal", () => {
    panel({
      ...details,
      teamRankings: details.teamRankings.map((row) =>
        row.team._id === "c"
          ? {
              ...row,
              scores: [
                { categoryScores: categoryScores(null, 5, 5) },
                { categoryScores: categoryScores(null, null, 5) },
              ],
            }
          : row,
      ),
    });
    expect(names()[0]).toBe("Choose Gamma");
    expect(within(rows()[0]).getAllByRole("cell")[2]).toHaveTextContent(
      "10.00",
    );
    fireEvent.change(screen.getByLabelText("Minimum judges"), {
      target: { value: "2" },
    });
    expect(names()).toEqual(["Choose Beta", "Choose Alpha"]);
  });

  it("uses a five-point maximum for a prize with one available category", () => {
    panel({
      ...details,
      categories: ["Design"],
      categoryRubric: [rubric[0]],
    });
    expect(
      screen.getByRole("columnheader", { name: "Prize score / 5" }),
    ).toBeInTheDocument();
    expect(names()).toEqual(["Choose Beta", "Choose Alpha", "Choose Gamma"]);
    expect(within(rows()[0]).getAllByRole("cell")[2]).toHaveTextContent("5.00");
    expect(within(rows()[1]).getAllByRole("cell")[2]).toHaveTextContent("2.00");
    expect(
      within(rows()[2]).getByText("Unscored for this prize"),
    ).toBeInTheDocument();
  });

  it("resets filters and restores the complete rubric for an overall prize", () => {
    panel();
    fireEvent.change(screen.getByLabelText("Minimum prize score / 10"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Prize"), {
      target: { value: "overall" },
    });
    expect(
      screen.getByRole("columnheader", { name: "Technical" }),
    ).toBeInTheDocument();
    expect(names()).toEqual(["Choose Gamma", "Choose Alpha", "Choose Beta"]);
    expect(
      screen.getByRole("columnheader", { name: "Overall score / 13.5" }),
    ).toBeInTheDocument();
    expect(within(rows()[0]).getAllByRole("cell")[2]).toHaveTextContent(
      "13.50",
    );
    expect(screen.getByLabelText("Minimum overall score / 13.5")).toHaveValue(
      null,
    );
    expect(
      screen.getByLabelText("Minimum overall score / 13.5"),
    ).toHaveAttribute("max", "13.5");
  });

  it("treats an unscored manual award as a manual decision with contextual scores", () => {
    panel();
    fireEvent.change(screen.getByLabelText("Prize"), {
      target: { value: "manual" },
    });
    expect(screen.getByText(/No score hint is configured/)).toBeInTheDocument();
    expect(screen.getByLabelText("Sort by")).toHaveValue("name");
    expect(names()).toEqual(["Choose Alpha", "Choose Beta", "Choose Gamma"]);
  });
});
