import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellVoteTest } from "@/components/code-and-tell/CodeAndTellVoteTest";

vi.mock("convex/react", () => ({
  useQuery: () => { throw new Error("Voting test must not query voter data"); },
  useMutation: () => { throw new Error("Voting test must not create database mutations"); },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("CodeAndTellVoteTest", () => {
  it("uses the real ballot UI, saves locally, and resets on remount without Convex hooks", async () => {
    const props = {
      eventId: "event-test" as Id<"events">,
      onBack: vi.fn(),
      event: {
        name: "Code & Tell", description: "Current event", startDate: Date.now(),
        endDate: Date.now(), status: "past" as const, codeAndTellPhase: "closed" as const,
        resultsReleased: true,
        teams: ["Real Project A", "Real Project B"].map((name, i) => ({
          _id: `team-${i}` as Id<"teams">, name, description: "Current project data",
        })),
      },
    };
    const first = render(<CodeAndTellVoteTest {...props} />);
    expect(screen.getByText("Voting open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Ballot" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Add to ballot" })) fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Move Real Project B up" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Ballot" }));
    expect(await screen.findByRole("button", { name: "Ballot submitted" })).toBeDisabled();
    first.unmount();
    render(<CodeAndTellVoteTest {...props} />);
    expect(screen.getByText("0 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Ballot" })).toBeDisabled();
  });
});
