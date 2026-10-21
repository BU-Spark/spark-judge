import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getEventScores,
  releaseResults,
  setWinners,
  withdrawResults,
} from "../../../convex/scores";
import {
  getResultReadiness,
  type ResultsInput,
} from "../../../shared/resultReadiness";
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));

function fixture(mode = "hackathon", admin = true) {
  const event: any = {
    _id: "event",
    mode,
    name: "Event",
    startDate: 1,
    endDate: 2,
    scoringLockedAt: 1,
    resultsReleased: false,
    categories: [{ name: "Innovation" }],
  };
  const tables: Record<string, any[]> = {
    teams: [
      {
        _id: "team",
        eventId: "event",
        name: "Garden",
        members: ["private member"],
        submittedBy: "private-user",
      },
    ],
    prizes: [
      { _id: "prize", eventId: "event", name: "Best project", type: "general" },
    ],
    prizeWinners: [
      { _id: "winner", eventId: "event", prizeId: "prize", teamId: "team" },
    ],
    teamPrizeSubmissions: [
      { eventId: "event", prizeId: "prize", teamId: "team" },
    ],
    scores: [
      {
        teamId: "team",
        totalScore: 4.5,
        judgeId: "private-judge",
        feedback: "private feedback",
      },
    ],
  };
  const db = {
    get: vi.fn(async (id: string) =>
      id === "event"
        ? event
        : id === "user"
          ? { _id: "user", isAdmin: admin }
          : tables.teams.find((team) => team._id === id),
    ),
    query: vi.fn((table: string) => ({
      withIndex: () => ({
        collect: async () => tables[table] ?? [],
        first: async () => null,
      }),
    })),
    patch: vi.fn(async (_id: string, values: object) =>
      Object.assign(event, values),
    ),
  };
  return { event, tables, db, ctx: { db } as any };
}

beforeEach(() => {
  vi.mocked(getAuthUserId).mockResolvedValue("user" as any);
});
describe("publication boundaries", () => {
  it("publishes a complete locked hackathon and preserves selections when withdrawn", async () => {
    const f = fixture();
    await (releaseResults as any)._handler(f.ctx, { eventId: "event" });
    expect(f.event.resultsReleased).toBe(true);
    await (withdrawResults as any)._handler(f.ctx, { eventId: "event" });
    expect(f.event.resultsReleased).toBe(false);
    expect(f.tables.prizeWinners).toHaveLength(1);
  });
  it.each([
    "active",
    "unlocked",
    "no prizes",
    "missing winner",
    "hidden winner",
    "ineligible winner",
  ])("rejects %s without publishing", async (condition) => {
    const f = fixture();
    if (condition === "active") f.event.endDate = Date.now() + 100000;
    if (condition === "unlocked") f.event.scoringLockedAt = undefined;
    if (condition === "no prizes") f.tables.prizes = [];
    if (condition === "missing winner") f.tables.prizeWinners = [];
    if (condition === "hidden winner") f.tables.teams[0].hidden = true;
    if (condition === "ineligible winner") f.tables.teamPrizeSubmissions = [];
    await expect(
      (releaseResults as any)._handler(f.ctx, { eventId: "event" }),
    ).rejects.toThrow();
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("requires an overall Demo Day winner but leaves categories optional", async () => {
    const f = fixture("demo_day");
    await expect(
      (releaseResults as any)._handler(f.ctx, { eventId: "event" }),
    ).rejects.toThrow("overall winner");
    f.event.overallWinner = "team";
    await (releaseResults as any)._handler(f.ctx, { eventId: "event" });
    expect(f.event.resultsReleased).toBe(true);
  });
  it("rejects invalid category winners and edits to published winners", async () => {
    const f = fixture("demo_day");
    await expect(
      (setWinners as any)._handler(f.ctx, {
        eventId: "event",
        overallWinner: "team",
        categoryWinners: [{ category: "Unknown", teamId: "team" }],
      }),
    ).rejects.toThrow("categories");
    f.event.resultsReleased = true;
    await expect(
      (setWinners as any)._handler(f.ctx, {
        eventId: "event",
        overallWinner: "team",
        categoryWinners: [],
      }),
    ).rejects.toThrow("Withdraw");
  });
  it("requires admin for publication and withdrawal", async () => {
    const f = fixture("hackathon", false);
    await expect(
      (releaseResults as any)._handler(f.ctx, { eventId: "event" }),
    ).rejects.toThrow();
    await expect(
      (withdrawResults as any)._handler(f.ctx, { eventId: "event" }),
    ).rejects.toThrow();
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("does not invalidate historical results when publication is retried", async () => {
    const f = fixture();
    f.event.resultsReleased = true;
    f.tables.prizes = [];
    await expect(
      (releaseResults as any)._handler(f.ctx, { eventId: "event" }),
    ).resolves.toBeUndefined();
    expect(f.db.patch).not.toHaveBeenCalled();
  });
});
describe("participant score summaries", () => {
  it("returns published summaries without judge details or hidden teams", async () => {
    const f = fixture("hackathon", false);
    f.event.resultsReleased = true;
    f.tables.teams.push({ _id: "hidden", name: "Secret", hidden: true });
    expect(
      await (getEventScores as any)._handler(f.ctx, { eventId: "event" }),
    ).toEqual([
      {
        team: { _id: "team", name: "Garden" },
        averageScore: 4.5,
        judgeCount: 1,
      },
    ]);
  });
  it.each(["draft", "active", "hidden event"])(
    "does not expose summaries for %s",
    async (condition) => {
      const f = fixture("hackathon", false);
      f.event.resultsReleased = true;
      if (condition === "draft") f.event.resultsReleased = false;
      if (condition === "active") f.event.endDate = Date.now() + 100000;
      if (condition === "hidden event") f.event.hidden = true;
      expect(
        await (getEventScores as any)._handler(f.ctx, { eventId: "event" }),
      ).toBeNull();
    },
  );
});
describe("shared readiness", () => {
  const input: ResultsInput = {
    mode: "code_and_tell",
    status: "past",
    scoringLocked: false,
    teams: [{ _id: "a", name: "A" }],
    prizes: [],
    prizeWinners: [],
    categories: [],
    categoryWinners: [],
    overallWinnerId: "a",
  };
  it("uses visible selected winners for Code & Tell", () => {
    expect(getResultReadiness(input).ready).toBe(true);
    expect(
      getResultReadiness({
        ...input,
        teams: [{ _id: "a", name: "A", hidden: true }],
      }).ready,
    ).toBe(false);
  });
  it("does not require an award for an inactive prize", () => {
    expect(
      getResultReadiness({
        ...input,
        mode: "hackathon",
        scoringLocked: true,
        prizes: [
          { _id: "p", name: "P" },
          { _id: "disabled", name: "Old", isActive: false },
        ],
        prizeWinners: [{ prizeId: "p", teamId: "a" }],
      }).ready,
    ).toBe(true);
  });
});
