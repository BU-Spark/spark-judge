import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getTeamById } from "../../../convex/teams";
import {
  getPrizeDeliberationData,
  setMyTeamPrizeSubmissions,
  setPrizeWinners,
  saveEventPrizes,
} from "../../../convex/prizes";
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));

function fixture(admin = false) {
  const event = {
    _id: "event",
    mode: "hackathon",
    name: "Hackathon",
    startDate: Date.now() - 1000,
    endDate: Date.now() + 3600000,
    scoringLockedAt: 10,
  };
  const team = {
    _id: "team",
    eventId: "event",
    name: "Garden",
    track: "Environment",
    description: "A garden app",
    members: ["Alex"],
    submittedBy: "user",
  };
  const prizes = [
    {
      _id: "first",
      eventId: "event",
      name: "First Hack",
      type: "general",
      sortOrder: 0,
    },
    {
      _id: "env",
      eventId: "event",
      name: "Env",
      type: "track",
      track: "Environment",
      entryMode: "automatic",
      sortOrder: 1,
    },
    {
      _id: "sponsor",
      eventId: "event",
      name: "Sponsor",
      type: "sponsor",
      sortOrder: 2,
    },
  ];
  const selections: any[] = [];
  const db = {
    get: vi.fn(async (id: string) =>
      id === "event"
        ? event
        : id === "team"
          ? team
          : id === "user"
            ? { _id: "user", isAdmin: admin }
            : null,
    ),
    query: vi.fn((table: string) => ({
      withIndex: () => ({
        first: async () => (table === "teams" ? team : null),
        collect: async () =>
          table === "prizes"
            ? prizes
            : table === "teams"
              ? [team]
              : table === "teamPrizeSubmissions"
                ? selections
                : [],
      }),
    })),
    insert: vi.fn(async (table: string, value: any) => {
      if (table === "teamPrizeSubmissions")
        selections.push({ _id: `entry-${selections.length}`, ...value });
      return "inserted";
    }),
    delete: vi.fn(async () => {}),
    patch: vi.fn(async (id: string, value: any) => {
      const prize = prizes.find((prize) => prize._id === id);
      if (prize) Object.assign(prize, value);
    }),
  };
  return { ctx: { db }, event, team, prizes, selections };
}
beforeEach(() => {
  vi.mocked(getAuthUserId).mockResolvedValue("user" as any);
});

describe("effective prize entry handlers", () => {
  it("saves the admin's automatic-entry setting and leaves other prizes opt-in", async () => {
    const { ctx, prizes } = fixture(true);
    const result = await (saveEventPrizes as any)._handler(ctx, {
      eventId: "event",
      prizes: prizes.map((prize) => ({
        prizeId: prize._id,
        name: prize.name,
        type: prize.type,
        track: prize.track,
        sponsorName: prize.type === "sponsor" ? "Acme" : undefined,
        entryMode: prize._id === "env" ? "automatic" : undefined,
      })),
    });
    expect(result.find((prize: any) => prize._id === "env").entryMode).toBe(
      "automatic",
    );
    expect(result.find((prize: any) => prize._id === "first").entryMode).toBe(
      "opt_in",
    );
  });

  it("rejects automatic entry for a sponsor prize", async () => {
    const { ctx } = fixture(true);
    await expect(
      (saveEventPrizes as any)._handler(ctx, {
        eventId: "event",
        prizes: [
          { name: "Best Use of API", type: "sponsor", entryMode: "automatic" },
        ],
      }),
    ).rejects.toThrow("can't use automatic entry");
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("rejects participant prize entry changes once scoring is locked", async () => {
    const { ctx } = fixture();
    await expect(
      (setMyTeamPrizeSubmissions as any)._handler(ctx, {
        eventId: "event",
        prizeIds: ["first"],
      }),
    ).rejects.toThrow("Prize selection is closed");
  });

  it("saves multiple optional entries and derives the automatic entry on project readback", async () => {
    const { ctx, event } = fixture();
    // Entrants choose prizes before the lock that winner selection requires.
    delete (event as { scoringLockedAt?: number }).scoringLockedAt;
    await (setMyTeamPrizeSubmissions as any)._handler(ctx, {
      eventId: "event",
      prizeIds: ["first", "env", "sponsor"],
    });
    expect(
      ctx.db.insert.mock.calls
        .filter(([table]) => table === "teamPrizeSubmissions")
        .map(([, row]) => row.prizeId)
        .sort(),
    ).toEqual(["first", "sponsor"]);
    const result = await (getTeamById as any)._handler(ctx, { teamId: "team" });
    expect(result.prizeEntries).toEqual([
      { _id: "first", name: "First Hack", automatic: false },
      { _id: "env", name: "Env", automatic: true },
      { _id: "sponsor", name: "Sponsor", automatic: false },
    ]);
    expect(JSON.stringify(result.prizeEntries)).not.toContain("submittedBy");
    expect(JSON.stringify(result.prizeEntries)).not.toContain("submittedAt");
  });
  it("includes automatic teams in admin deliberation without a stored entry", async () => {
    const { ctx } = fixture(true);
    const result = await (getPrizeDeliberationData as any)._handler(ctx, {
      eventId: "event",
    });
    expect(
      result.prizes.find((row: any) => row.prize._id === "env").candidates,
    ).toEqual([expect.objectContaining({ teamId: "team" })]);
    expect(
      result.prizes.find((row: any) => row.prize._id === "first")
        .submissionCount,
    ).toBe(0);
  });
  it("allows an automatic entrant to win and rejects a team that never selected an optional prize", async () => {
    const { ctx } = fixture(true);
    await expect(
      (setPrizeWinners as any)._handler(ctx, {
        eventId: "event",
        winners: [{ prizeId: "env", teamId: "team" }],
      }),
    ).resolves.toBeNull();
    await expect(
      (setPrizeWinners as any)._handler(ctx, {
        eventId: "event",
        winners: [{ prizeId: "first", teamId: "team" }],
      }),
    ).rejects.toThrow("submitted for that prize");
  });
  it.each(["demo_day", "code_and_tell"])(
    "never requests prize data for %s project pages",
    async (mode) => {
      const { ctx, event } = fixture();
      event.mode = mode;
      const result = await (getTeamById as any)._handler(ctx, {
        teamId: "team",
      });
      expect(result.prizeEntries).toEqual([]);
      expect(ctx.db.query).not.toHaveBeenCalled();
    },
  );
  it("does not expose hidden project prize entries to visitors", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const { ctx, team } = fixture();
    Object.assign(team, { hidden: true });
    expect(
      await (getTeamById as any)._handler(ctx, { teamId: "team" }),
    ).toBeNull();
    expect(ctx.db.query).not.toHaveBeenCalled();
  });
});
