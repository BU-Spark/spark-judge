import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
const { query, saveTeam, savePrizes } = vi.hoisted(() => ({
  query: vi.fn(),
  saveTeam: vi.fn(),
  savePrizes: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
  useMutation: (ref: any) =>
    getFunctionName(ref) === "prizes:setMyTeamPrizeSubmissions"
      ? savePrizes
      : saveTeam,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { TeamSubmissionModal } from "../../../src/components/TeamSubmissionModalNew";
const team = {
  _id: "team",
  name: "Garden",
  description: "A garden app",
  members: ["Alex"],
  githubUrl: "https://github.com/example/garden",
  track: "Environment",
};
const prizes = [
  {
    _id: "env",
    eventId: "event",
    name: "Env",
    type: "track",
    track: "Environment",
    entryMode: "automatic",
  },
  { _id: "first", eventId: "event", name: "First Hack", type: "general" },
  {
    _id: "sponsor",
    eventId: "event",
    name: "Sponsor Prize",
    type: "sponsor",
    sponsorName: "Acme",
  },
];
const stored = ["first"];
let catalogue: typeof prizes | undefined;
const onClose = vi.fn();
const props = {
  isOpen: true,
  onClose,
  eventId: "event" as Id<"events">,
  tracks: ["Environment", "Health"],
  eventMode: "hackathon" as const,
  existingTeam: team,
};
beforeEach(() => {
  vi.clearAllMocks();
  catalogue = prizes;
  saveTeam.mockResolvedValue("team");
  savePrizes.mockResolvedValue(null);
  query.mockImplementation((ref) => {
    const name = getFunctionName(ref);
    return name === "teams:getMyTeam"
      ? team
      : name === "prizes:listEventPrizes"
        ? catalogue
        : stored;
  });
});

describe("multiple optional prizes alongside automatic track entries", () => {
  it("shows the automatic entry as checked and locked, and saves multiple optional selections", async () => {
    render(<TeamSubmissionModal {...props} />);
    const automatic = within(
      screen.getByRole("group", { name: "Automatic prize entries" }),
    ).getByRole("checkbox");
    expect(automatic).toBeChecked();
    expect(automatic).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /First Hack/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Sponsor Prize/ }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update Team" }));
    // Project and prize entries are saved by one atomic mutation.
    await waitFor(() =>
      expect(saveTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event",
          teamId: "team",
          prizeIds: ["first", "sponsor"],
        }),
      ),
    );
    expect(saveTeam).toHaveBeenCalledTimes(1);
    expect(savePrizes).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  it("keeps saved choices when the prize catalog loads after the submission IDs", () => {
    catalogue = undefined;
    const view = render(<TeamSubmissionModal {...props} />);
    expect(screen.getByRole("button", { name: "Update Team" })).toBeDisabled();
    catalogue = prizes;
    view.rerender(<TeamSubmissionModal {...props} />);
    expect(screen.getByRole("checkbox", { name: /First Hack/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Update Team" })).toBeEnabled();
  });
  it("updates automatic entries on track change without losing optional choices", () => {
    render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Track/), {
      target: { value: "Health" },
    });
    expect(
      screen.queryByRole("group", { name: "Automatic prize entries" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /First Hack/ })).toBeChecked();
  });
  it("preserves hidden selections when filtering prizes by sponsor", () => {
    render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText("Filter by sponsor"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sponsor Prize/ }));
    fireEvent.change(screen.getByLabelText("Filter by sponsor"), {
      target: { value: "" },
    });
    expect(screen.getByRole("checkbox", { name: /First Hack/ })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Sponsor Prize/ }),
    ).toBeChecked();
  });
});
