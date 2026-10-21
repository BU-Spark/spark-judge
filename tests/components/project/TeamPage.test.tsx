import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";

const { query, identity, appreciation, send, toastError } = vi.hoisted(() => ({
  query: vi.fn(),
  identity: vi.fn(),
  appreciation: vi.fn(),
  send: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
}));
vi.mock("../../../src/lib/demoDayIdentity", () => ({
  useAttendeeIdentity: () => identity(),
}));
vi.mock("../../../src/lib/demoDayApi", () => ({
  useAppreciation: () => appreciation(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
import { TeamPage } from "../../../src/components/TeamPage";

const eventId = "event_1" as Id<"events">;
const teamId = "team_1" as Id<"teams">;
let event: { name: string; mode: string; status: string };
let team: {
  _id: Id<"teams">;
  eventId: Id<"events">;
  name: string;
  description: string;
  members: string[];
  event: { name: string };
  hidden?: boolean;
  track?: string;
  courseCode?: string;
  prizeEntries?: { _id: string; name: string; automatic: boolean }[];
};
const data = {
  totalCount: 12,
  attendeeCount: 2,
  attendeeTotalCount: 2,
  attendeeRemainingBudget: 98,
  maxPerAttendee: 100,
  maxPerTeam: 10,
};
function renderProject() {
  return render(
    <MemoryRouter>
      <TeamPage eventId={eventId} teamId={teamId} />
    </MemoryRouter>,
  );
}
function queriedAppreciations() {
  return query.mock.calls.some(
    ([ref]) =>
      getFunctionName(ref) === "appreciations:getSingleTeamAppreciation",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  event = { name: "An event", mode: "hackathon", status: "active" };
  team = {
    _id: teamId,
    eventId,
    name: "AgriSense",
    description: "A garden project.",
    members: ["Jordan"],
    event: { name: event.name },
  };
  identity.mockReturnValue({ attendeeId: "attendee", isLoading: false });
  appreciation.mockReturnValue({
    appreciate: send,
    isLoading: false,
    isAuthenticated: true,
  });
  send.mockResolvedValue({
    success: true,
    remainingForTeam: 7,
    remainingTotal: 97,
  });
  query.mockImplementation((ref) => {
    const name = getFunctionName(ref);
    if (name === "events:getEvent") return event;
    if (name === "teams:getTeamById") return team;
    if (name === "appreciations:getSingleTeamAppreciation") return data;
    throw new Error(`Unexpected query ${name}`);
  });
});

describe("project pages across event formats", () => {
  it("shows every entered prize and distinguishes automatic entries", () => {
    team.prizeEntries = [
      { _id: "first", name: "First Hack", automatic: false },
      { _id: "env", name: "Env", automatic: true },
    ];
    team.track = "Environment";
    renderProject();
    expect(
      screen.getByRole("list", { name: "Prize entries" }).children,
    ).toHaveLength(2);
    expect(screen.getByText("First Hack")).toBeInTheDocument();
    expect(screen.getByText("Env")).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Track: Environment"),
    ).not.toBeInTheDocument();
  });
  it("shows the Hackathon track instead of a course", () => {
    team.track = "Environment";
    team.courseCode = "CS 506";
    renderProject();
    expect(screen.getByLabelText("Track: Environment")).toBeInTheDocument();
    expect(screen.queryByText("CS 506")).not.toBeInTheDocument();
  });

  it("shows the course for Demo Day instead of a track", () => {
    event.mode = "demo_day";
    team.track = "Environment";
    team.courseCode = "CS 506";
    renderProject();
    expect(screen.getByLabelText("Course: CS 506")).toBeInTheDocument();
    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
  });

  it("does not fall back to a course when a Hackathon has no track", () => {
    team.courseCode = "CS 506";
    renderProject();
    expect(screen.queryByText("CS 506")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Track:/)).not.toBeInTheDocument();
  });

  it("omits course and track labels for Code & Tell", () => {
    event.mode = "code_and_tell";
    team.courseCode = "CS 506";
    team.track = "Environment";
    renderProject();
    expect(screen.queryByText("CS 506")).not.toBeInTheDocument();
    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
  });

  it.each(["hackathon", "code_and_tell"])(
    "renders %s without requesting Demo Day data",
    (mode) => {
      event.mode = mode;
      renderProject();
      expect(
        screen.getByRole("heading", { name: "AgriSense" }),
      ).toBeInTheDocument();
      expect(screen.getByText("A garden project.")).toBeInTheDocument();
      expect(queriedAppreciations()).toBe(false);
      expect(identity).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: /appreciation/i }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["hidden", "different event"])(
    "does not load appreciation data for a project in a %s state",
    (state) => {
      event.mode = "demo_day";
      if (state === "hidden") team.hidden = true;
      else team.eventId = "other_event" as Id<"events">;
      renderProject();
      expect(
        screen.getByRole("heading", { name: "Project unavailable" }),
      ).toBeInTheDocument();
      expect(queriedAppreciations()).toBe(false);
    },
  );

  it("shows Demo Day counts and keeps the server-confirmed quota after a send", async () => {
    event.mode = "demo_day";
    send.mockResolvedValue({
      success: true,
      remainingForTeam: 0,
      remainingTotal: 90,
    });
    renderProject();
    expect(screen.getByText("12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Give appreciation" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Project limit reached" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByText("10 / 10 given to this project"),
    ).toBeInTheDocument();
    expect(screen.getByText(/90 left to share/)).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("opens the shared sign-in dialog for a signed-out visitor", () => {
    event.mode = "demo_day";
    appreciation.mockReturnValue({
      appreciate: send,
      isLoading: false,
      isAuthenticated: false,
    });
    const open = vi.fn();
    window.addEventListener("hackjudge:open-signin", open);
    renderProject();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in to appreciate" }),
    );
    expect(open).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    window.removeEventListener("hackjudge:open-signin", open);
  });

  it("keeps closed-event appreciation controls disabled", () => {
    event.mode = "demo_day";
    event.status = "past";
    renderProject();
    expect(
      screen.getByRole("button", { name: "Appreciations closed" }),
    ).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the quota available when a send fails", async () => {
    event.mode = "demo_day";
    send.mockResolvedValue({ success: false, error: "Please try again." });
    renderProject();
    fireEvent.click(screen.getByRole("button", { name: "Give appreciation" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Please try again."),
    );
    expect(
      screen.getByRole("button", { name: "Give appreciation" }),
    ).toBeEnabled();
    expect(
      screen.getByText("2 / 10 given to this project"),
    ).toBeInTheDocument();
  });
});
