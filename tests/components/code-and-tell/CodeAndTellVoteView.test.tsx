import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Sign in to vote")).toBeInTheDocument();
    expect(
      screen.getByText("Use your event account to unlock ballot editing."),
    ).toBeInTheDocument();
  });

  it("loads an existing ballot and marks owned projects as ineligible", () => {
    queryResults.set("auth:loggedInUser", {
      _id: "user-1",
      email: "voter@example.com",
    });
    queryResults.set("codeAndTell:getVotingContext", {
      ...(queryResults.get("codeAndTell:getVotingContext") as object),
      currentBallotTeamIds: [
        "team-2" as Id<"teams">,
        "team-3" as Id<"teams">,
      ],
    });

    render(
      <CodeAndTellVoteView
        eventId={eventId}
        event={baseEvent}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Your project")).toBeInTheDocument();
    expect(screen.getAllByText("Project Two").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Project Three").length).toBeGreaterThan(0);
    expect(screen.getByText("Existing ballot loaded. You can replace it until the event ends.")).toBeInTheDocument();
    expect(screen.getByText("Ineligible")).toBeInTheDocument();
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

    fireEvent.click(screen.getByText("Save Ballot"));

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

    expect(screen.getByText("Results Released")).toBeInTheDocument();
    expect(screen.getAllByText("Project Two").length).toBeGreaterThan(0);
    expect(screen.getByText("Top Standings")).toBeInTheDocument();
  });
});
