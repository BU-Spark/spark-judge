import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";
import { JudgeCodeModal } from "../../src/components/JudgeCodeModalNew";

const joinAsJudge = vi.hoisted(() => vi.fn());
const verifyCode = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const name = getFunctionName(ref as never);
    if (name === "events:joinAsJudge") return joinAsJudge;
    if (name === "events:verifyJudgeCodeAndStartJudging") return verifyCode;
    throw new Error(`Unexpected mutation ${name}`);
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const EVENT_ID = "event_1" as Id<"events">;

function renderModal() {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    eventId: EVENT_ID,
  };
  render(<JudgeCodeModal {...props} />);
  fireEvent.change(screen.getByLabelText("Code"), {
    target: { value: "abc123" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Verify & start judging" }),
  );
  return props;
}

describe("JudgeCodeModal", () => {
  beforeEach(() => {
    joinAsJudge.mockReset();
    verifyCode.mockReset();
  });

  it("registers the judge before verifying the code", async () => {
    const calls: string[] = [];
    joinAsJudge.mockImplementation(async () => {
      calls.push("join");
      return "judge_1";
    });
    verifyCode.mockImplementation(async () => {
      calls.push("verify");
      return true;
    });

    const props = renderModal();

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(["join", "verify"]);
    expect(joinAsJudge).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(verifyCode).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      judgeCode: "ABC123",
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows the join error and skips verification when registration fails", async () => {
    joinAsJudge.mockRejectedValue(
      new Error("You are already a participant for this event"),
    );

    const props = renderModal();

    expect(
      await screen.findByText("You are already a participant for this event"),
    ).toBeInTheDocument();
    expect(verifyCode).not.toHaveBeenCalled();
    expect(props.onSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Verify & start judging" }),
    ).toBeEnabled();
  });

  it("shows the verification error after a successful join", async () => {
    joinAsJudge.mockResolvedValue("judge_1");
    verifyCode.mockRejectedValue(new Error("Invalid judge code"));

    const props = renderModal();

    expect(await screen.findByText("Invalid judge code")).toBeInTheDocument();
    expect(joinAsJudge).toHaveBeenCalledTimes(1);
    expect(props.onSuccess).not.toHaveBeenCalled();
  });
});
