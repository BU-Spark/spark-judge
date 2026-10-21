import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResultsTab } from "../../../src/features/admin/tabs/ResultsTab";
import { DemoDayWinnersPanel } from "../../../src/features/admin/panels/DemoDayWinnersPanel";
import { PrizeWinnerWizardPanel } from "../../../src/features/admin/panels/PrizeWinnerWizardPanel";
import { ScoringDashboard } from "../../../src/features/admin/components/ScoringDashboard";
import { CodeAndTellWinnerPanel } from "../../../src/features/admin/panels/CodeAndTellWinnerPanel";
import type { ResultsInput } from "../../../shared/resultReadiness";
const input: ResultsInput = {
  mode: "hackathon",
  status: "past",
  scoringLocked: true,
  teams: [{ _id: "a", name: "Garden" }],
  prizes: [{ _id: "p", name: "Best" }],
  prizeWinners: [{ prizeId: "p", teamId: "a" }],
  categories: [],
  categoryWinners: [],
};
function results(overrides: Record<string, unknown> = {}) {
  const props = {
    input,
    eventName: "Night",
    publicUrl: "/event/a",
    published: false,
    editing: false,
    editor: null,
    onEdit: vi.fn(),
    onScores: vi.fn(),
    onPrizes: vi.fn(),
    onFinish: vi.fn(),
    onLock: vi.fn(),
    locking: false,
    onPublish: vi.fn().mockResolvedValue(null),
    onWithdraw: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <ResultsTab {...props} />
    </MemoryRouter>,
  );
  return props;
}
describe("Results workflow", () => {
  it("requires review before publishing and permits retry after failure", async () => {
    const publish = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection failed"))
      .mockResolvedValue(null);
    results({ onPublish: publish });
    expect(
      screen.queryByRole("button", { name: "Publish results" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publish results" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Garden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish results" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
  });
  it("explains missing winners and cannot publish", () => {
    results({ input: { ...input, prizeWinners: [] } });
    expect(
      screen.getByText("Choose a valid winner for 1 remaining prize."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review and publish" }),
    ).not.toBeInTheDocument();
  });
  it("blocks double publication while pending", async () => {
    let finish!: () => void;
    const publish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    results({ onPublish: publish });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish results" }));
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();
    expect(publish).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() =>
      expect(screen.queryByText("Publishing…")).not.toBeInTheDocument(),
    );
  });
  it("asks for withdrawal before correcting a published result", () => {
    const props = results({ published: true });
    expect(
      screen.getByRole("link", { name: "View published results" }),
    ).toHaveAttribute("href", "/event/a");
    fireEvent.click(screen.getByRole("button", { name: "Correct results" }));
    expect(props.onWithdraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw results" }));
    expect(props.onWithdraw).toHaveBeenCalledTimes(1);
  });
});
describe("winner editors", () => {
  it("keeps a Code & Tell selection after a failed save and allows retry", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection failed"))
      .mockResolvedValue(null);
    const close = vi.fn();
    render(
      <CodeAndTellWinnerPanel
        eventId={"e" as any}
        standings={["Garden", "Map"].map((name, index) => ({
          teamId: name as any,
          name,
          description: "",
          points: 10 - index,
          ballotsCount: 2,
          rankCounts: [1, 1],
        }))}
        defaultWinnerId={"Garden" as any}
        totalBallots={2}
        onClose={close}
        onSubmit={submit}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Choose Map" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and review" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("radio", { name: "Choose Map" })).toBeChecked();
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save and review" }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenLastCalledWith({
      eventId: "e",
      winnerTeamId: "Map",
    });
  });
  it("restores Demo Day selections and preserves categories when saving", async () => {
    const submit = vi.fn().mockResolvedValue(null);
    render(
      <DemoDayWinnersPanel
        eventId={"e" as any}
        teams={[
          { _id: "a" as any, name: "Garden" },
          { _id: "b" as any, name: "Map" },
        ]}
        categories={["Impact"]}
        existingOverallWinner={"a" as any}
        existingCategoryWinners={[{ category: "Impact", teamId: "b" as any }]}
        onClose={vi.fn()}
        onSubmit={submit}
      />,
    );
    expect(screen.getByRole("radio", { name: /Garden/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /Impact.*Map/ }));
    expect(screen.getByRole("radio", { name: /Map/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save and review" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        eventId: "e",
        overallWinner: "a",
        categoryWinners: [{ category: "Impact", teamId: "b" }],
      }),
    );
  });
  it("keeps partial hackathon saves open and only closes on Save and review", async () => {
    const submit = vi.fn().mockResolvedValue(null);
    const close = vi.fn();
    render(
      <PrizeWinnerWizardPanel
        eventId={"e" as any}
        deliberationData={{
          prizes: [
            {
              prize: { _id: "p" as any, name: "Best" },
              candidates: [
                {
                  teamId: "a" as any,
                  teamName: "Garden",
                  averageScore: 4,
                  judgeCount: 2,
                },
              ],
            },
            { prize: { _id: "q" as any, name: "Impact" }, candidates: [] },
          ],
        }}
        existingWinners={[]}
        onSubmit={submit}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Choose Garden" }));
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
    await waitFor(() =>
      expect(screen.getByText("Selections saved")).toBeInTheDocument(),
    );
    expect(close).not.toHaveBeenCalled();
    expect(submit.mock.calls[0][0].winners).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Save and review" }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
});
it("keeps score ranks and ties stable through keyboard-accessible sorting", () => {
  render(
    <ScoringDashboard
      scores={{
        categories: [],
        categoryRankings: {},
        judgeBreakdown: [],
        teamRankings: [
          { team: { _id: "z", name: "Zebra" }, averageScore: 5, judgeCount: 2 },
          { team: { _id: "b", name: "Birch" }, averageScore: 5, judgeCount: 3 },
          { team: { _id: "a", name: "Apple" }, averageScore: 3, judgeCount: 1 },
          { team: { _id: "n", name: "None" }, averageScore: 0, judgeCount: 0 },
        ],
      }}
      viewMode="table"
      setViewMode={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Team Name" }));
  expect(
    within(screen.getByText("Apple").closest("tr")!).getByText("#3"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByText("Zebra").closest("tr")!).getByText("#1"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByText("Birch").closest("tr")!).getByText("#1"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByText("None").closest("tr")!).getByText("Unranked"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("columnheader", { name: "Team Name" }),
  ).toHaveAttribute("aria-sort", "ascending");
});
