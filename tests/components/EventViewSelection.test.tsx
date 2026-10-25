import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
}));
vi.mock("../../src/components/ScoringWizard", () => ({
  ScoringWizard: ({ teams }: { teams: unknown[] }) => (
    <div>Scoring {teams.length} projects</div>
  ),
}));
vi.mock("../../src/components/JudgeCodeModal", () => ({
  JudgeCodeModal: () => null,
}));
import { EventView } from "../../src/components/EventView";

describe("direct team selection", () => {
  it("opens a selected project without a queue or assignment query on a legacy cohort event", async () => {
    query.mockImplementation((reference) => {
      const name = getFunctionName(reference);
      if (name === "events:getEvent")
        return {
          _id: "event",
          name: "Test event",
          mode: "hackathon",
          status: "active",
          enableCohorts: true,
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
          ],
        };
      if (name === "events:getJudgeStatus")
        return { _id: "judge", userId: "user" };
      if (name === "auth:loggedInUser") return { _id: "user" };
      if (name.startsWith("judgeAssignments:"))
        throw new Error("Assignment query should not be needed");
      return [];
    });
    render(
      <MemoryRouter initialEntries={["/event/event?team=alpha"]}>
        <EventView eventId={"event" as any} onBack={() => {}} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Scoring 2 projects")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Score Alpha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Score Beta" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("My queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Select teams first")).not.toBeInTheDocument();
  });
});
