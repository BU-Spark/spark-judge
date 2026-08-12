import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Id } from "../../../convex/_generated/dataModel";
import { ScoringWizard } from "../../../src/components/ScoringWizard";

const mockSubmit = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockSubmit),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const EVENT_ID = "event_1" as Id<"events">;
const STORAGE_KEY = "scoring-wizard-draft";

const defaultTeams = [
  {
    _id: "team_gamma" as Id<"teams">,
    name: "Gamma",
    description: "Third",
    members: ["g"],
  },
  {
    _id: "team_alpha" as Id<"teams">,
    name: "Alpha",
    description: "First",
    members: ["a"],
  },
  {
    _id: "team_beta" as Id<"teams">,
    name: "Beta",
    description: "Second",
    members: ["b"],
  },
];

const defaultCategories = [
  { name: "Impact", optOutAllowed: true },
  { name: "Craft", optOutAllowed: false },
];

function renderWizard(
  overrides: Partial<{
    eventId: Id<"events">;
    teams: typeof defaultTeams;
    categories: typeof defaultCategories;
    storageKey: string | null;
    onClose: () => void;
    onSubmitted: () => void;
    initialTeamId: Id<"teams"> | null;
  }> = {},
) {
  const props = {
    eventId: EVENT_ID,
    teams: defaultTeams,
    categories: defaultCategories,
    storageKey: STORAGE_KEY,
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
    ...overrides,
  };
  const view = render(<ScoringWizard {...props} />);
  return { ...view, props };
}

function scoreKey(value: number, category: string) {
  return screen.getByRole("button", { name: `Score ${value} for ${category}` });
}

function writeDraft(currentIndex: number) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      scores: {},
      completed: [],
      skipped: [],
      currentIndex,
      timestamp: Date.now(),
    }),
  );
}

describe("ScoringWizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(null);
  });

  it("renders the first team alphabetically with five score keys per category", () => {
    renderWizard();

    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Score \d for Impact/ })).toHaveLength(
      5,
    );
    expect(screen.getAllByRole("button", { name: /Score \d for Craft/ })).toHaveLength(
      5,
    );
    expect(scoreKey(3, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(scoreKey(3, "Craft")).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on initialTeamId when no localStorage draft exists", () => {
    renderWizard({ initialTeamId: "team_gamma" as Id<"teams"> });

    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
  });

  it("lets a stored draft currentIndex take precedence over initialTeamId", async () => {
    writeDraft(2);
    renderWizard({ initialTeamId: "team_beta" as Id<"teams"> });

    expect(await screen.findByRole("heading", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Beta" })).not.toBeInTheDocument();
  });

  it("marks a clicked score key pressed and advances criterion on keyboard 1–5", () => {
    renderWizard();

    fireEvent.click(scoreKey(5, "Impact"));
    expect(scoreKey(5, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(scoreKey(3, "Impact")).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "4" });
    expect(scoreKey(4, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: /Craft/ })).toHaveClass("is-focused");

    fireEvent.keyDown(window, { key: "2" });
    expect(scoreKey(2, "Craft")).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles opt-out with 0 on optOutAllowed categories and ignores it otherwise", () => {
    renderWizard();

    fireEvent.keyDown(window, { key: "0" });
    expect(screen.getByRole("button", { name: "Marked N/A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const value of [1, 2, 3, 4, 5]) {
      expect(scoreKey(value, "Impact")).toHaveAttribute("aria-pressed", "false");
    }

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(scoreKey(3, "Craft")).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "0" });
    expect(scoreKey(3, "Craft")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Marked N/A" })).toBeInTheDocument();
  });

  it("shows the draft readout after a score change when storageKey is set", async () => {
    renderWizard();

    fireEvent.click(scoreKey(5, "Impact"));

    expect(await screen.findByText(/Draft · saved/i)).toBeInTheDocument();
  });

  it("marks a team completed on Next and opens a flat take-sheet after the last team", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("01 of 03 scored")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Take sheet" }));

    expect(screen.getByRole("heading", { name: "Take sheet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("submits completed teams, clears the draft, and calls onSubmitted", async () => {
    const { props } = renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Take sheet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    const defaultCategoryScores = [
      { category: "Impact", score: 3, optedOut: false },
      { category: "Craft", score: 3, optedOut: false },
    ];
    expect(mockSubmit).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      scores: [
        { teamId: "team_alpha", categoryScores: defaultCategoryScores },
        { teamId: "team_beta", categoryScores: defaultCategoryScores },
        { teamId: "team_gamma", categoryScores: defaultCategoryScores },
      ],
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(props.onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("does not submit when no teams are completed", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Take sheet" }));
    const submit = screen.getByRole("button", { name: "Submit scores" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("marks the current team skipped and advances", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("00 of 03 scored")).toBeInTheDocument();
  });
});
