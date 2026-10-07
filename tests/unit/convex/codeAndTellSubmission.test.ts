import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  saveSubmission,
  setPhase,
  saveBallot,
  validateSubmission,
} from "../../../convex/codeAndTell";
import { codeAndTellPhase } from "../../../convex/codeAndTellPhase";
import { computeEventStatus } from "../../../convex/helpers";
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));
const input = {
  eventId: "event",
  name: "  Demo  ",
  description: "A useful thing.",
  members: ["Alex"],
  entrantEmails: ["TEAM@example.com"],
};
function fixture(
  phase = "submissions",
  existing: any = null,
  admin = false,
  ballot: any = null,
) {
  const event = {
    _id: "event",
    mode: "code_and_tell",
    codeAndTellPhase: phase,
    startDate: 0,
    endDate: 1,
  };
  const db = {
    get: vi.fn(async (id: string) =>
      id === "event"
        ? event
        : { _id: "user", email: "alex@example.com", isAdmin: admin },
    ),
    query: vi.fn((table: string) => ({
      withIndex: (index: string) => ({
        collect: async () =>
          table === "teams" ? (existing ? [existing] : []) : [],
        first: async () =>
          table === "rankedVotes"
            ? ballot
            : table === "teams" && index === "by_event_and_submitter"
              ? existing
              : null,
      }),
    })),
    insert: vi.fn(async () => "new-team"),
    patch: vi.fn(async () => {}),
  };
  return { db };
}
beforeEach(() => {
  vi.mocked(getAuthUserId).mockResolvedValue("user" as any);
});
describe("Code & Tell participation", () => {
  it("creates a project and automatically associates the submitter email", async () => {
    const ctx = fixture();
    await (saveSubmission as any)._handler(ctx, input);
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "teams",
      expect.objectContaining({
        name: "Demo",
        submittedBy: "user",
        entrantEmails: ["alex@example.com", "team@example.com"],
      }),
    );
  });
  it("updates the existing submission instead of inserting another project", async () => {
    const ctx = fixture("submissions", {
      _id: "team",
      name: "Old",
      submittedBy: "user",
    });
    await (saveSubmission as any)._handler(ctx, input);
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "team",
      expect.objectContaining({ name: "Demo" }),
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
  it("rejects anonymous submissions", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const ctx = fixture();
    await expect((saveSubmission as any)._handler(ctx, input)).rejects.toThrow(
      "Sign in",
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
  it.each(["presentations", "voting", "closed"])(
    "rejects submission changes during %s",
    async (phase) => {
      const ctx = fixture(phase);
      await expect(
        (saveSubmission as any)._handler(ctx, input),
      ).rejects.toThrow("closed");
      expect(ctx.db.insert).not.toHaveBeenCalled();
    },
  );
  it("does not open voting merely because presentations are active", async () => {
    await expect(
      (saveBallot as any)._handler(fixture("presentations"), {
        eventId: "event",
        rankedTeamIds: [],
      }),
    ).rejects.toThrow("Ballots can only");
  });
  it("requires admin access to change stages", async () => {
    await expect(
      (setPhase as any)._handler(fixture(), {
        eventId: "event",
        phase: "voting",
      }),
    ).rejects.toThrow("admin access");
  });
  it("prevents reopening submissions after ballots exist", async () => {
    await expect(
      (setPhase as any)._handler(
        fixture("closed", null, true, { _id: "ballot" }),
        { eventId: "event", phase: "submissions" },
      ),
    ).rejects.toThrow("cannot reopen");
  });
  it("keeps organizer-controlled stages independent of the clock", () => {
    expect(
      computeEventStatus({
        mode: "code_and_tell",
        codeAndTellPhase: "voting",
        startDate: 0,
        endDate: 1,
      }),
    ).toBe("active");
    expect(
      codeAndTellPhase({ codeAndTellPhase: "voting", resultsReleased: true }),
    ).toBe("closed");
  });
  it("rejects executable project links and malformed email addresses", () => {
    expect(() =>
      validateSubmission({ ...input, projectUrl: "javascript:alert(1)" }),
    ).toThrow("http");
    expect(() =>
      validateSubmission({ ...input, entrantEmails: ["not-email"] }),
    ).toThrow("email");
  });
});
