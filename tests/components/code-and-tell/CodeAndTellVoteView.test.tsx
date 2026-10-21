import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteView } from "@/components/code-and-tell/CodeAndTellVoteView";

const functionNameSymbol = Symbol.for("functionName");
const queryResults = vi.hoisted(() => new Map<string, unknown>());
const saveBallotMock = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (
    queryRef: { [key: symbol]: string | undefined },
    args?: unknown,
  ) => {
    if (args === "skip") return undefined;
    return queryResults.get(queryRef?.[functionNameSymbol] || "");
  },
  useMutation: () => saveBallotMock,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CodeAndTellVoteView", () => {
  const eventId = "event-1" as Id<"events">;
  const baseEvent = {
    name: "Code & Tell Spring",
    description: "Small project showcase",
    startDate: Date.now(),
    endDate: Date.now() + 60_000,
    status: "active" as const,
    resultsReleased: false,
    teams: [
      {
        _id: "team-1" as Id<"teams">,
        name: "Owned Project",
        description: "My own work",
      },
      {
        _id: "team-2" as Id<"teams">,
        name: "Project Two",
        description: "Searchable compiler",
      },
      {
        _id: "team-3" as Id<"teams">,
        name: "Project Three",
        description: "Visual debugger",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
    window.localStorage.clear();
    saveBallotMock.mockResolvedValue("vote-1");
    queryResults.set("codeAndTell:getPublicResults", null);
    queryResults.set("codeAndTell:getVotingContext", {
      myEmail: "voter@example.com",
      ownProjectIds: ["team-1" as Id<"teams">],
      requiredRankCount: 2,
      eligibleProjectCount: 2,
      currentBallotTeamIds: [],
      maxBallots: null,
      rankedVoteRowCount: 0,
      hasSubmittedBallot: false,
      votingClosedToNewVoters: false,
      projects: [
        {
          _id: "team-1" as Id<"teams">,
          name: "Owned Project",
          description: "My own work",
          members: ["Alice"],
          entrantEmails: ["voter@example.com"],
          isOwned: true,
          isEligible: false,
        },
        {
          _id: "team-2" as Id<"teams">,
          name: "Project Two",
          description: "Searchable compiler",
          members: ["Bob"],
          entrantEmails: ["bob@example.com"],
          isOwned: false,
          isEligible: true,
          projectUrl: "https://example.com/two",
        },
        {
          _id: "team-3" as Id<"teams">,
          name: "Project Three",
          description: "Visual debugger",
          members: ["Cara"],
          entrantEmails: ["cara@example.com"],
          isOwned: false,
          isEligible: true,
        },
      ],
    });
  });

  it("requires sign in before voting", () => {
    queryResults.set("auth:loggedInUser", null);
    const onSignIn = vi.fn();

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
        onSignIn={onSignIn}
      />,
    );

    expect(screen.getByText("Project Two")).toBeInTheDocument();
    const ballot = screen.getByRole("complementary", { name: "Your ballot" });
    expect(ballot.querySelectorAll(".ballot-slot")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Save Ballot" })).not.toBeInTheDocument();
    screen.getAllByRole("button", { name: "Add to ballot" }).forEach((button) =>
      expect(button).toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in to vote" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("loads an existing ballot and marks owned projects as ineligible", () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    queryResults.set("codeAndTell:getVotingContext", {
      ...(queryResults.get("codeAndTell:getVotingContext") as object),
      currentBallotTeamIds: ["team-2" as Id<"teams">, "team-3" as Id<"teams">],
    });

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("You can’t vote for your own project.")).toBeInTheDocument();
    expect(screen.getAllByText("Project Two").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Project Three").length).toBeGreaterThan(0);
    expect(screen.getByText("Ranked #1")).toBeInTheDocument();
    expect(screen.getByText("Ranked #2")).toBeInTheDocument();
  });

  it("adds eligible projects and saves a completed ballot", async () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );

    const addButtons = screen.getAllByText("Add to ballot");
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    fireEvent.click(screen.getAllByText("Save Ballot")[0]);

    await waitFor(() => {
      expect(saveBallotMock).toHaveBeenCalledWith({
        eventId,
        rankedTeamIds: ["team-2", "team-3"],
      });
    });
  });

  it("renders public results after release", () => {
    queryResults.set("auth:loggedInUser", null);
    queryResults.set("codeAndTell:getPublicResults", {
      winnerTeamId: "team-2" as Id<"teams">,
      totalBallots: 7,
      standings: [
        {
          teamId: "team-2" as Id<"teams">,
          name: "Project Two",
          description: "Searchable compiler",
          points: 27,
          ballotsCount: 7,
          rankCounts: [4, 2, 1, 0, 0],
        },
      ],
    });

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={{ ...baseEvent, status: "past", resultsReleased: true }}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Results available")).toBeInTheDocument();
    expect(screen.getAllByText("Project Two").length).toBeGreaterThan(0);
    expect(screen.getByText("The audience’s favorites")).toBeInTheDocument();
    const winnerCard = screen.getByText(
      "Your Code & Tell winner.",
    ).parentElement!;
    expect(within(winnerCard).getByText("27")).toBeInTheDocument();
    expect(within(winnerCard).getByText("4 ballots")).toBeInTheDocument();
    expect(within(winnerCard).getByText("2 ballots")).toBeInTheDocument();
    expect(within(winnerCard).getByText("#5 choice")).toBeInTheDocument();
  });
  it("saves the order chosen with accessible move buttons", async () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add to ballot" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Move Project Three up" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));
    await waitFor(() =>
      expect(saveBallotMock).toHaveBeenCalledWith({
        eventId,
        rankedTeamIds: ["team-3", "team-2"],
      }),
    );
  });

  it("keeps ballot choices available for retry after a failed save", async () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    saveBallotMock.mockRejectedValueOnce(new Error("Offline"));
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add to ballot" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Ballot" })).toBeEnabled(),
    );
    expect(
      screen.getByRole("button", { name: "Move Project Three up" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your ballot is safely stored."),
    ).not.toBeInTheDocument();
  });
  it("shows projects before voting without a presenter form", () => {
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={{
          ...baseEvent,
          status: "upcoming",
          codeAndTellPhase: "submissions",
        }}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Projects to rank" })).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.queryByText("Sign up to present")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
  });

  it.each([null, { _id: "user-1", email: "voter@example.com" }])(
    "keeps small project lists visible and ballot disabled during presentations for %s",
    (user) => {
      queryResults.set("auth:loggedInUser", user);
      render(
        <CodeAndTellVoteView
          eventId={eventId}
          event={{ ...baseEvent, codeAndTellPhase: "presentations" }}
          onBack={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Your ballot" }),
      ).toBeInTheDocument();
      const addButtons = screen.getAllByRole("button", {
        name: "Add to ballot",
      });
      addButtons.forEach((button) => expect(button).toBeDisabled());
      if (user) {
        const saveButton = screen.getByRole("button", { name: "Save Ballot" });
        expect(saveButton).toBeDisabled();
        fireEvent.click(saveButton);
      } else {
        expect(screen.getByRole("button", { name: "Sign in to vote" })).toBeEnabled();
        expect(document.querySelectorAll(".ballot-slot")).toHaveLength(0);
        expect(screen.queryByRole("button", { name: "Save Ballot" })).not.toBeInTheDocument();
      }
      fireEvent.click(addButtons[0]);
      expect(saveBallotMock).not.toHaveBeenCalled();
      expect(screen.queryByRole("searchbox", { name: "Search projects" })).not.toBeInTheDocument();
      expect(screen.getByText("Project Two")).toBeInTheDocument();
      expect(screen.getByText("Project Three")).toBeInTheDocument();
    },
  );
  it.each([9, 10])("shows search only with at least 10 projects, given %s", (count) => {
    queryResults.set("auth:loggedInUser", null);
    const teams = Array.from({ length: count }, (_, index) => ({
      _id: `team-${index}` as Id<"teams">,
      name: `Project ${index}`,
      description: `Description ${index}`,
    }));
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={{ ...baseEvent, teams, codeAndTellPhase: "presentations" }}
        onBack={vi.fn()}
      />,
    );
    const search = screen.queryByRole("searchbox", { name: "Search projects" });
    if (count < 10) {
      expect(search).not.toBeInTheDocument();
    } else {
      expect(search).toBeInTheDocument();
      fireEvent.change(search!, { target: { value: "Project 9" } });
      expect(screen.getByText("Project 9")).toBeInTheDocument();
      expect(screen.queryByText("Project 0")).not.toBeInTheDocument();
      expect(search).toBeInTheDocument();
    }
  });
  it("shows the saved ballot in submitted order after voting closes", () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    queryResults.set("codeAndTell:getMyBallot", ["team-3", "team-2"]);
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={{ ...baseEvent, codeAndTellPhase: "closed" }}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Your submitted ballot" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["1Project Three", "2Project Two"]);
    expect(
      screen.queryByRole("button", { name: "Save Ballot" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove|Move/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Voting closed")).toBeInTheDocument();
  });
  it("does not show someone else's ballot when signed out", () => {
    queryResults.set("auth:loggedInUser", null);
    queryResults.set("codeAndTell:getMyBallot", ["team-3", "team-2"]);
    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={{ ...baseEvent, codeAndTellPhase: "closed" }}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByText("Your submitted ballot")).not.toBeInTheDocument();
    expect(screen.getByText("Voting closed")).toBeInTheDocument();
  });
  it("distinguishes loading a ballot from having no submitted ballot", () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    const props = {
      eventId,
      event: { ...baseEvent, codeAndTellPhase: "closed" as const },
      onBack: vi.fn(),
    };
    const view = render(<CodeAndTellVoteView {...props} />);
    expect(
      screen.getByText("Loading your submitted ballot..."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("You didn’t submit a ballot for this event."),
    ).not.toBeInTheDocument();
    queryResults.set("codeAndTell:getMyBallot", []);
    view.rerender(<CodeAndTellVoteView {...props} />);
    expect(
      screen.getByText("You didn’t submit a ballot for this event."),
    ).toBeInTheDocument();
  });
  describe("ballot drafts and live updates", () => {
    const voter = { _id: "user-1", email: "voter@example.com" };
    const baseContext = () =>
      queryResults.get("codeAndTell:getVotingContext") as Record<string, unknown> & {
        projects: Array<Record<string, unknown>>;
      };
    const setServerBallot = (ids: string[]) =>
      queryResults.set("codeAndTell:getVotingContext", {
        ...baseContext(),
        currentBallotTeamIds: ids,
      });
    const rankedNames = () =>
      Array.from(
        document.querySelectorAll("#your-ballot .ballot-slot:not(.ballot-slot--empty) strong"),
      ).map((node) => node.textContent);
    const renderView = () =>
      render(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);

    it("restores an unsubmitted ranking after reload and can discard it", async () => {
      queryResults.set("auth:loggedInUser", voter);
      const first = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[1]);
      expect(
        await screen.findByText("Draft saved on this device — not submitted"),
      ).toBeInTheDocument();
      first.unmount();

      renderView();
      expect(rankedNames()).toEqual(["Project Three"]);
      expect(
        screen.getByText("Draft saved on this device — not submitted"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Ballot submitted")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
      expect(rankedNames()).toEqual([]);
      expect(
        screen.queryByText("Draft saved on this device — not submitted"),
      ).not.toBeInTheDocument();
    });

    it("does not restore another account's draft", () => {
      queryResults.set("auth:loggedInUser", voter);
      const first = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      first.unmount();

      queryResults.set("auth:loggedInUser", { _id: "user-2", email: "other@example.com" });
      renderView();
      expect(rankedNames()).toEqual([]);
      expect(screen.queryByRole("button", { name: "Discard draft" })).not.toBeInTheDocument();
    });

    it("clears the draft after the server confirms the save", async () => {
      queryResults.set("auth:loggedInUser", voter);
      const first = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));
      fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));
      expect(await screen.findByRole("button", { name: "Ballot submitted" })).toBeDisabled();
      expect(document.querySelector(".task-status")).toHaveTextContent("Ballot submitted");
      expect(window.localStorage.getItem(`hackjudge:draft:code-and-tell-ballot:${eventId}:user-1`)).toBeNull();
      first.unmount();

      renderView();
      expect(rankedNames()).toEqual([]);
    });

    it("keeps unsaved local changes when another tab saves a ballot", () => {
      queryResults.set("auth:loggedInUser", voter);
      const view = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      expect(rankedNames()).toEqual(["Project Two"]);

      setServerBallot(["team-3", "team-2"]);
      view.rerender(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);
      expect(rankedNames()).toEqual(["Project Two"]);
      expect(screen.getByRole("button", { name: "Use saved ballot" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
      expect(rankedNames()).toEqual(["Project Two"]);
      expect(screen.queryByRole("button", { name: "Use saved ballot" })).not.toBeInTheDocument();

      setServerBallot(["team-2", "team-3"]);
      view.rerender(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Use saved ballot" }));
      expect(rankedNames()).toEqual(["Project Two", "Project Three"]);
    });

    it("adopts a new server ballot when there are no local edits", () => {
      queryResults.set("auth:loggedInUser", voter);
      const view = renderView();
      setServerBallot(["team-3", "team-2"]);
      view.rerender(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);
      expect(rankedNames()).toEqual(["Project Three", "Project Two"]);
      expect(screen.queryByRole("button", { name: "Use saved ballot" })).not.toBeInTheDocument();
    });

    it("removes projects that become ineligible and names the affected slot", () => {
      queryResults.set("auth:loggedInUser", voter);
      const view = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));

      queryResults.set("codeAndTell:getVotingContext", {
        ...baseContext(),
        projects: baseContext().projects.filter((project) => project._id !== "team-3"),
      });
      view.rerender(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);
      expect(rankedNames()).toEqual(["Project Two"]);
      expect(screen.getByText(/#2 Project Three/)).toBeInTheDocument();
    });

    it("keeps edits made while an earlier save is pending", async () => {
      queryResults.set("auth:loggedInUser", voter);
      let resolveSave!: () => void;
      saveBallotMock.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveSave = resolve; }),
      );
      const view = renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));
      fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));
      expect(saveBallotMock).toHaveBeenCalledWith({
        eventId,
        rankedTeamIds: ["team-2", "team-3"],
      });

      fireEvent.click(screen.getByRole("button", { name: "Move Project Three up" }));
      expect(rankedNames()).toEqual(["Project Three", "Project Two"]);

      // The live query reflects the earlier save before the mutation resolves.
      setServerBallot(["team-2", "team-3"]);
      view.rerender(<CodeAndTellVoteView eventId={eventId} event={baseEvent} onBack={vi.fn()} />);
      resolveSave();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Save Ballot" })).toBeEnabled(),
      );
      expect(rankedNames()).toEqual(["Project Three", "Project Two"]);
      expect(screen.queryByRole("button", { name: "Use saved ballot" })).not.toBeInTheDocument();
      expect(
        screen.getByText("Draft saved on this device — not submitted"),
      ).toBeInTheDocument();
    });

    it("shows a persistent failure with retry and keeps the ranking", async () => {
      queryResults.set("auth:loggedInUser", voter);
      saveBallotMock.mockRejectedValueOnce(new Error("Ballot rejected: voting is closed"));
      renderView();
      fireEvent.click(screen.getAllByRole("button", { name: "Add to ballot" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Add to ballot" }));
      fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));

      expect(await screen.findByText("Your ballot wasn’t saved")).toBeInTheDocument();
      expect(rankedNames()).toEqual(["Project Two", "Project Three"]);
      expect(screen.queryByText("Ballot submitted")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Retry saving ballot" }));
      expect(await screen.findByRole("button", { name: "Ballot submitted" })).toBeInTheDocument();
      expect(screen.queryByText("Your ballot wasn’t saved")).not.toBeInTheDocument();
      expect(saveBallotMock).toHaveBeenCalledTimes(2);
    });
  });
});
