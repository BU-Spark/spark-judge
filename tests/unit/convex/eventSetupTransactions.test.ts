import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createEventWithPrizes, updateJudgingSettings } from "../../../convex/events";

vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));

function makeCtx(options: { event?: Record<string, unknown>; hasScore?: boolean } = {}) {
  const rows = new Map<string, any>();
  rows.set("admin", { _id: "admin", isAdmin: true });
  if (options.event) rows.set("event", { _id: "event", ...options.event });
  const db = {
    get: vi.fn(async (id: string) => rows.get(id) ?? null),
    insert: vi.fn(async (table: string, value: any) => {
      const id = `${table}-${rows.size}`;
      rows.set(id, { _id: id, ...value });
      return id;
    }),
    patch: vi.fn(async (id: string, value: any) => {
      rows.set(id, { ...rows.get(id), ...value });
    }),
    query: vi.fn((table: string) => ({
      withIndex: () => ({
        first: async () => (table === "scores" && options.hasScore ? { _id: "score" } : null),
        collect: async () => [],
      }),
    })),
  };
  return { ctx: { db } as any, rows };
}

const baseEventArgs = {
  name: "Spring Hack",
  status: "upcoming" as const,
  startDate: Date.now() + 1000,
  endDate: Date.now() + 3_600_000,
  categories: [{ name: "Design", weight: 1 }],
  tracks: ["AI"],
  mode: "hackathon" as const,
};

beforeEach(() => {
  vi.mocked(getAuthUserId).mockResolvedValue("admin" as any);
});

describe("createEventWithPrizes", () => {
  it("inserts the event and its prizes in one mutation", async () => {
    const { ctx } = makeCtx();
    const eventId = await (createEventWithPrizes as any)._handler(ctx, {
      ...baseEventArgs,
      prizes: [{ name: "Best Overall", type: "general", scoreBasis: "overall" }],
    });
    const tables = ctx.db.insert.mock.calls.map(([table]: [string]) => table);
    expect(tables).toEqual(["events", "prizes"]);
    expect(ctx.db.insert.mock.calls[1][1]).toMatchObject({ eventId, name: "Best Overall" });
    expect(ctx.db.insert.mock.calls[0][1]).not.toHaveProperty("prizes");
  });

  it("throws on an invalid prize so the transaction rolls back the event", async () => {
    const { ctx } = makeCtx();
    await expect(
      (createEventWithPrizes as any)._handler(ctx, {
        ...baseEventArgs,
        prizes: [{ name: "Track prize", type: "track", track: "Not a track" }],
      }),
    ).rejects.toThrow("invalid track");
  });

  it("rejects prizes for non-hackathon events before inserting anything", async () => {
    const { ctx } = makeCtx();
    await expect(
      (createEventWithPrizes as any)._handler(ctx, {
        ...baseEventArgs,
        mode: "demo_day",
        prizes: [{ name: "Best", type: "general" }],
      }),
    ).rejects.toThrow("hackathon");
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});

describe("updateJudgingSettings", () => {
  const args = {
    eventId: "event",
    categories: [
      { name: " Design ", weight: 1 },
      { name: "Impact", weight: 1.5, optOutAllowed: true },
    ],
    enableCohorts: true,
    judgeCode: " SECRET ",
  };

  it("writes categories, cohorts, and judge code in a single patch", async () => {
    const { ctx } = makeCtx({ event: { mode: "hackathon", judgeCode: "" } });
    await (updateJudgingSettings as any)._handler(ctx, args);
    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith("event", {
      categories: [
        { name: "Design", weight: 1 },
        { name: "Impact", weight: 1.5, optOutAllowed: true },
      ],
      enableCohorts: true,
      judgeCode: "SECRET",
    });
  });

  it("refuses to change settings once scoring has started", async () => {
    const { ctx } = makeCtx({ event: { mode: "hackathon" }, hasScore: true });
    await expect((updateJudgingSettings as any)._handler(ctx, args)).rejects.toThrow(
      "scoring has started",
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("refuses to change settings while scoring is locked", async () => {
    const { ctx } = makeCtx({ event: { mode: "hackathon", scoringLockedAt: 1 } });
    await expect((updateJudgingSettings as any)._handler(ctx, args)).rejects.toThrow("locked");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("rejects unnamed categories without writing", async () => {
    const { ctx } = makeCtx({ event: { mode: "hackathon" } });
    await expect(
      (updateJudgingSettings as any)._handler(ctx, {
        ...args,
        categories: [{ name: "  ", weight: 1 }],
      }),
    ).rejects.toThrow("name");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});
