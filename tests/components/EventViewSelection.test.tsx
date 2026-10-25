import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";

const query = vi.hoisted(() => vi.fn());
const mutate = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
  useMutation: (reference: any) => (args: unknown) =>
    mutate(getFunctionName(reference), args),
}));
vi.mock("../../src/components/ScoringWizard", () => ({
  ScoringWizard: ({
    teams,
    initialTeamId,
  }: {
    teams: unknown[];
    initialTeamId: string;
  }) => (
    <div>
      Scoring {teams.length} projects, starting with {initialTeamId}
    </div>
  ),
}));
vi.mock("../../src/components/JudgeCodeModal", () => ({
  JudgeCodeModal: () => null,
}));
import { EventView } from "../../src/components/EventView";

let assignments: string[];
let cohorts: boolean;
let locked: boolean;
const eventId = "event" as any;
function view(path = "/event/event") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <EventView eventId={eventId} onBack={() => {}} />
    </MemoryRouter>
  );
}

describe("judge team cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    assignments = ["alpha"];
    cohorts = true;
    locked = false;
    mutate.mockResolvedValue(null);
    query.mockImplementation((reference) => {
      const name = getFunctionName(reference);
      if (name === "events:getEvent")
        return {
          _id: "event",
          name: "Test event",
          mode: "hackathon",
          status: "active",
          enableCohorts: cohorts,
          scoringLockedAt: locked ? 1 : undefined,
          startDate: Date.now() - 1000,
          endDate: Date.now() + 3600_000,
          categories: [{ name: "Impact", weight: 1 }],
          teams: [
            {
              _id: "alpha",
              name: "Alpha",
              description: "First project",
              track: "Health",
            },
            {
              _id: "beta",
              name: "Beta",
              description: "Second project",
              track: "Health",
            },
            {
              _id: "gamma",
              name: "Gamma",
              description: "Third project",
              track: "Art",
            },
          ],
        };
      if (name === "events:getJudgeStatus")
        return { _id: "judge", userId: "user" };
      if (name === "auth:loggedInUser") return { _id: "user" };
      if (name === "judgeAssignments:getMyAssignments") return assignments;
      return [];
    });
  });

  it("scores only queued projects and passes the clicked team's ID", async () => {
    render(view("/event/event?team=alpha"));
    expect(
      await screen.findByText("Scoring 1 projects, starting with alpha"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "My queue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Score Alpha" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Score Beta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Beta to queue" }),
    ).toBeInTheDocument();
  });

  it("adds and removes teams using the persistent judge assignments", async () => {
    const rendered = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Add Beta to queue" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "judgeAssignments:addTeamToAssignment",
        { eventId: "event", teamId: "beta" },
      ),
    );
    assignments = ["alpha", "beta"];
    rendered.rerender(view());
    expect(
      screen.getByRole("link", { name: "Score Beta" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Beta from queue" }),
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "judgeAssignments:removeTeamFromAssignment",
        { eventId: "event", teamId: "beta" },
      ),
    );
  });

  it("adds only the unqueued teams matching the current filters", async () => {
    render(view());
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Beta" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add all 1 filtered team" }),
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "judgeAssignments:addMultipleTeamsToAssignment",
        { eventId: "event", teamIds: ["beta"] },
      ),
    );
  });

  it("requires a selection before starting an empty cart", () => {
    assignments = [];
    render(view());
    expect(
      screen.getByRole("button", { name: "Select teams first" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add Alpha to queue" }),
    ).toBeEnabled();
  });

  it("prevents cart changes while scoring is locked", () => {
    locked = true;
    render(view());
    expect(
      screen.getByRole("button", { name: "Add Beta to queue" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Remove Alpha from queue" }),
    ).not.toBeInTheDocument();
  });

  it("keeps direct scoring for events without team queues", async () => {
    cohorts = false;
    render(view("/event/event?team=beta"));
    expect(
      await screen.findByText("Scoring 3 projects, starting with beta"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My queue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Score Beta" }),
    ).toBeInTheDocument();
  });
});
