import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Id } from "../../../convex/_generated/dataModel";
import { ScoringWizard } from "../../../src/components/ScoringWizard";
import { scoringDraftKey } from "../../../src/lib/scoringDraft";
import { writeDraft as writeVersionedDraft } from "../../../src/lib/draftStorage";

const mockSubmit = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastWarning = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockSubmit),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  },
}));

const EVENT_ID = "event_1" as Id<"events">;
const STORAGE_KEY = "scoring-wizard-draft";
const DRAFT_KEY = scoringDraftKey(STORAGE_KEY);

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

function nextButton() {
  return screen.getByRole("button", { name: "Next" });
}

function scoreAll(impact = 3, craft = 3) {
  fireEvent.click(scoreKey(impact, "Impact"));
  fireEvent.click(scoreKey(craft, "Craft"));
}

function expectNothingPressed(category: string) {
  for (const value of [1, 2, 3, 4, 5]) {
    expect(scoreKey(value, category)).toHaveAttribute("aria-pressed", "false");
  }
}

/** Writes a pre-versioning draft directly at the caller's key. */
function writeLegacyDraft(currentIndex: number) {
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
    expect(
      screen.getAllByRole("button", { name: /Score \d for Impact/ }),
    ).toHaveLength(5);
    expect(
      screen.getAllByRole("button", { name: /Score \d for Craft/ }),
    ).toHaveLength(5);
    expectNothingPressed("Impact");
    expectNothingPressed("Craft");
  });

  it("keeps Next disabled until every category is answered", () => {
    renderWizard();

    expect(nextButton()).toBeDisabled();
    expect(
      screen.getByText("Score every category to continue · 2 left"),
    ).toBeInTheDocument();

    fireEvent.click(scoreKey(4, "Impact"));
    expect(nextButton()).toBeDisabled();
    expect(
      screen.getByText("Score every category to continue · 1 left"),
    ).toBeInTheDocument();

    fireEvent.click(nextButton());
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();

    fireEvent.click(scoreKey(2, "Craft"));
    expect(nextButton()).toBeEnabled();
    expect(screen.queryByText(/Score every category/)).not.toBeInTheDocument();
  });

  it("counts N/A as an answer only where opt-out is allowed", () => {
    renderWizard();

    fireEvent.click(
      screen.getByRole("button", { name: "Not comfortable judging this" }),
    );
    expect(nextButton()).toBeDisabled();
    fireEvent.click(scoreKey(5, "Craft"));
    expect(nextButton()).toBeEnabled();

    // Un-marking N/A leaves the category unanswered, not defaulted.
    fireEvent.click(screen.getByRole("button", { name: "Marked N/A" }));
    expectNothingPressed("Impact");
    expect(nextButton()).toBeDisabled();
  });

  it("scores a full team from the keyboard and focuses Next once enabled", async () => {
    renderWizard();

    fireEvent.keyDown(window, { key: "4" });
    expect(nextButton()).toBeDisabled();
    fireEvent.keyDown(window, { key: "5" });

    expect(nextButton()).toBeEnabled();
    await waitFor(() => expect(nextButton()).toHaveFocus());
  });

  it("returns keyboard focus to the first unanswered criterion", () => {
    renderWizard();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "2" });

    expect(nextButton()).toBeDisabled();
    expect(screen.getByRole("group", { name: /Impact/ })).toHaveClass(
      "is-focused",
    );
  });

  it("opens on initialTeamId when no localStorage draft exists", () => {
    renderWizard({ initialTeamId: "team_gamma" as Id<"teams"> });

    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
  });

  it("lets a stored draft currentIndex take precedence over initialTeamId", async () => {
    writeLegacyDraft(2);
    renderWizard({ initialTeamId: "team_beta" as Id<"teams"> });

    expect(
      await screen.findByRole("heading", { name: "Gamma" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Beta" }),
    ).not.toBeInTheDocument();
  });

  it("marks a clicked score key pressed and advances criterion on keyboard 1–5", () => {
    renderWizard();

    fireEvent.click(scoreKey(5, "Impact"));
    expect(scoreKey(5, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(scoreKey(3, "Impact")).toHaveAttribute("aria-pressed", "false");
    expect(scoreKey(3, "Craft")).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "4" });
    expect(scoreKey(4, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: /Craft/ })).toHaveClass(
      "is-focused",
    );

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
      expect(scoreKey(value, "Impact")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.click(scoreKey(3, "Craft"));
    fireEvent.keyDown(window, { key: "0" });
    expect(scoreKey(3, "Craft")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: "Marked N/A" }),
    ).toBeInTheDocument();
  });

  it("shows the draft readout after a score change when storageKey is set", async () => {
    renderWizard();

    fireEvent.click(scoreKey(5, "Impact"));

    expect(
      await screen.findByText(/Draft saved on this device/i),
    ).toBeInTheDocument();
  });

  it("marks a team completed on Next and opens a score review after the last team", () => {
    renderWizard();

    scoreAll();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("01 of 03 scored")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review scores" }));

    expect(
      screen.getByRole("heading", { name: "Review scores" }),
    ).toBeInTheDocument();
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

    scoreAll(5, 4);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Not comfortable judging this" }),
    );
    fireEvent.click(scoreKey(1, "Craft"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    scoreAll(2, 3);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "Review scores" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      scores: [
        {
          teamId: "team_alpha",
          categoryScores: [
            { category: "Impact", score: 5, optedOut: false },
            { category: "Craft", score: 4, optedOut: false },
          ],
        },
        {
          teamId: "team_beta",
          categoryScores: [
            { category: "Impact", score: null, optedOut: true },
            { category: "Craft", score: 1, optedOut: false },
          ],
        },
        {
          teamId: "team_gamma",
          categoryScores: [
            { category: "Impact", score: 2, optedOut: false },
            { category: "Craft", score: 3, optedOut: false },
          ],
        },
      ],
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(props.onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("does not submit when no teams are completed", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Review scores" }));
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
  it("can revisit a completed project from review and retain its score", () => {
    renderWizard();
    scoreAll(5, 2);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Review scores" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(scoreKey(5, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(scoreKey(2, "Craft")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(scoreKey(4, "Impact"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
  });

  it("Previous opens the completed project without skipping it", () => {
    renderWizard();
    scoreAll();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
  });

  it("keeps every score and shows an inline failure when submission is rejected", async () => {
    mockSubmit.mockRejectedValueOnce(
      new Error("Scoring is locked for this event"),
    );
    const { props } = renderWizard({ teams: [defaultTeams[1]] });
    scoreAll(4, 2);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Scores not submitted");
    expect(alert).toHaveTextContent("Scoring is locked for this event");
    expect(alert).toHaveTextContent("Your scores for 1 project are kept");
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByText("Save rejected; your changes are kept")).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(props.onSubmitted).not.toHaveBeenCalled();

    // Scores survive the rejection.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(scoreKey(4, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(scoreKey(2, "Craft")).toHaveAttribute("aria-pressed", "true");
  });

  it("offers a retry for a retryable failure and succeeds on retry", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("Something odd"));
    const { props } = renderWizard({ teams: [defaultTeams[1]] });
    scoreAll();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledTimes(1));
    expect(mockSubmit).toHaveBeenCalledTimes(2);
    expect(mockSubmit.mock.calls[1][0]).toEqual(mockSubmit.mock.calls[0][0]);
  });

  it("checks server scores after a network failure and treats a match as saved", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("Failed to fetch"));
    const onSubmitted = vi.fn();
    const props = {
      eventId: EVENT_ID,
      teams: [defaultTeams[1]],
      categories: defaultCategories,
      storageKey: STORAGE_KEY,
      onClose: vi.fn(),
      onSubmitted,
      existingScores: [],
    };
    const { rerender } = render(<ScoringWizard {...props} />);
    scoreAll(5, 3);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    expect(
      await screen.findByText("Checking whether your scores saved…"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit scores" })).toBeDisabled();
    expect(onSubmitted).not.toHaveBeenCalled();

    rerender(
      <ScoringWizard
        {...props}
        existingScores={[
          {
            teamId: "team_alpha" as Id<"teams">,
            categoryScores: [
              { category: "Impact", score: 5, optedOut: false },
              { category: "Craft", score: 3, optedOut: false },
            ],
          },
        ]}
      />,
    );

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("keeps scores in memory and warns when this device can't store the draft", async () => {
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    try {
      renderWizard();
      fireEvent.click(scoreKey(4, "Impact"));
      fireEvent.click(scoreKey(2, "Craft"));

      expect(
        await screen.findByText(/Not saved on this device/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Draft saved on this device/),
      ).not.toBeInTheDocument();
      expect(scoreKey(4, "Impact")).toHaveAttribute("aria-pressed", "true");
      expect(scoreKey(2, "Craft")).toHaveAttribute("aria-pressed", "true");
      expect(nextButton()).toBeEnabled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("treats a submission as successful when draft removal throws, and never restores it", async () => {
    const removeItem = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("Storage blocked");
      });
    try {
      const { props, unmount } = renderWizard({ teams: [defaultTeams[1]] });
      scoreAll(5, 5);
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

      await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledTimes(1));
      expect(toastSuccess).toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      unmount();
    } finally {
      removeItem.mockRestore();
    }

    renderWizard({ teams: [defaultTeams[1]] });
    expect(
      await screen.findByRole("heading", { name: "Alpha" }),
    ).toBeInTheDocument();
    expectNothingPressed("Impact");
    expectNothingPressed("Craft");
  });

  it("does not report a submission failure when onSubmitted throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSubmitted = vi.fn(() => {
      throw new Error("navigation failed");
    });
    renderWizard({ teams: [defaultTeams[1]], onSubmitted });
    scoreAll();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    consoleError.mockRestore();
  });

  it("sets an unreadable draft aside and tells the judge", async () => {
    window.localStorage.setItem(DRAFT_KEY, "{not json");
    renderWizard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't be read, so it was set aside/,
    );
    expect(window.localStorage.getItem(`${DRAFT_KEY}:unreadable`)).toBe(
      "{not json",
    );
  });

  it("restores the selected team by ID and drops scores for removed teams and categories", async () => {
    writeVersionedDraft(DRAFT_KEY, 2, {
      scores: {
        team_beta: {
          Impact: { score: 4, optedOut: false },
          Retired: { score: 2, optedOut: false },
        },
        team_removed: {
          Impact: { score: 3, optedOut: false },
          Craft: { score: 3, optedOut: false },
        },
      },
      completed: ["team_removed"],
      skipped: [],
      currentTeamId: "team_beta",
    });
    renderWizard();

    expect(
      await screen.findByRole("heading", { name: "Beta" }),
    ).toBeInTheDocument();
    expect(scoreKey(4, "Impact")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "3 saved scores were removed from your draft",
    );
    expect(screen.getByText("00 of 03 scored")).toBeInTheDocument();
  });

  it("shows a partially answered team as incomplete and does not submit it", async () => {
    renderWizard();

    scoreAll(4, 4);
    fireEvent.click(nextButton());
    // Beta: answer one category, then leave via Review.
    fireEvent.click(scoreKey(5, "Impact"));
    fireEvent.click(screen.getByRole("button", { name: "Review scores" }));

    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByText(/1 category left/)).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Submit scores" }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    const { scores } = mockSubmit.mock.calls[0][0];
    expect(scores).toEqual([
      {
        teamId: "team_alpha",
        categoryScores: [
          { category: "Impact", score: 4, optedOut: false },
          { category: "Craft", score: 4, optedOut: false },
        ],
      },
    ]);
  });

  it("loads an old partial draft without defaulting missing categories", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scores: {
          // Old drafts could mark a team completed with only some categories.
          team_alpha: { Impact: { score: 5, optedOut: false } },
          team_beta: {
            Impact: { score: 2, optedOut: false },
            Craft: { score: 4, optedOut: false },
          },
        },
        completed: ["team_alpha", "team_beta"],
        skipped: [],
        currentIndex: 0,
        timestamp: Date.now(),
      }),
    );
    renderWizard();

    expect(
      await screen.findByRole("heading", { name: "Alpha" }),
    ).toBeInTheDocument();
    expect(scoreKey(5, "Impact")).toHaveAttribute("aria-pressed", "true");
    expectNothingPressed("Craft");
    expect(nextButton()).toBeDisabled();
    expect(screen.getByText("01 of 03 scored")).toBeInTheDocument();
  });

  it("shows previously submitted server scores with their real values", async () => {
    render(
      <ScoringWizard
        eventId={EVENT_ID}
        teams={defaultTeams}
        categories={defaultCategories}
        storageKey={null}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
        existingScores={[
          {
            teamId: "team_alpha" as Id<"teams">,
            categoryScores: [
              { category: "Impact", score: null, optedOut: true },
              { category: "Craft", score: 2, optedOut: false },
            ],
          },
        ]}
        initialTeamId={"team_alpha" as Id<"teams">}
      />,
    );

    expect(await screen.findByText("01 of 03 scored")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review scores" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("button", { name: "Marked N/A" })).toBeInTheDocument();
    expect(scoreKey(2, "Craft")).toHaveAttribute("aria-pressed", "true");
    expect(nextButton()).toBeEnabled();
  });
});
