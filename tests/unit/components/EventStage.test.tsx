import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EventStage,
  stageAction,
  type StageEvent,
} from "../../../src/components/home/EventStage";

const event: StageEvent = {
  _id: "e1",
  name: "Community Demo Day",
  mode: "demo_day",
  status: "upcoming",
  startDate: 2_000_000,
  endDate: 3_000_000,
};
function show(override: Partial<React.ComponentProps<typeof EventStage>> = {}) {
  const props = {
    focal: { event, phase: "pre" as const },
    events: { active: [], upcoming: [event], past: [] },
    projects: [],
    loading: false,
    now: 1_000_000,
    demo: false,
    onSelectLive: vi.fn(),
    onOpenEvent: vi.fn(),
    onParticipate: vi.fn(),
    onOpenProject: vi.fn(),
    ...override,
  };
  render(<EventStage {...props} />);
  return props;
}

describe("automatic event entry", () => {
  it("features the upcoming event without a format chooser", () => {
    const p = show();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      event.name,
    );
    expect(
      screen.queryByRole("group", { name: "Choose a live event" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore the event" }));
    expect(p.onParticipate).toHaveBeenCalledOnce();
  });
  it("offers a selection only for multiple live events", () => {
    const other = {
      ...event,
      _id: "e2",
      name: "CivicHacks",
      mode: "hackathon",
      status: "active" as const,
    };
    const live = { ...event, status: "active" as const };
    const p = show({
      focal: { event: live, phase: "live" },
      events: { active: [live, other], upcoming: [], past: [] },
    });
    fireEvent.click(screen.getByRole("button", { name: "CivicHacks" }));
    expect(p.onSelectLive).toHaveBeenCalledWith("e2");
    expect(screen.getByRole("button", { name: event.name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("does not invite voting or imply results exist during an unreleased recap", () => {
    show({
      focal: {
        event: { ...event, mode: "code_and_tell", status: "past" },
        phase: "post",
      },
    });
    expect(
      screen.getByText("The event has ended. Results have not been released."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start your ballot|View results/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Rank up to five favorites."),
    ).not.toBeInTheDocument();
  });
  it("links each project to its own details rather than a generic entry", () => {
    const project = { _id: "p1", name: "Voltify" };
    const p = show({ projects: [project] });
    fireEvent.click(screen.getByRole("button", { name: "View Voltify" }));
    expect(p.onOpenProject).toHaveBeenCalledWith(project);
  });
  it("keeps the secondary calendar and past events accessible with no featured event", () => {
    show({
      focal: null,
      events: {
        active: [],
        upcoming: [],
        past: [{ ...event, status: "past" }],
      },
    });
    expect(
      screen.getByRole("heading", { name: "On the calendar" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Past events"));
    expect(
      screen.getByRole("button", { name: /Community Demo Day/ }),
    ).toBeInTheDocument();
  });
});

describe("participation labels respect event state", () => {
  it("does not advertise locked scoring and only offers released results", () => {
    expect(
      stageAction({ ...event, mode: "hackathon", scoringLockedAt: 1 }, "live"),
    ).toBe("View event");
    expect(stageAction({ ...event, resultsReleased: true }, "post")).toBe(
      "View results",
    );
    expect(
      stageAction(
        { ...event, mode: "code_and_tell", hasRankedVote: true },
        "live",
      ),
    ).toBe("Edit your ballot");
  });
});
