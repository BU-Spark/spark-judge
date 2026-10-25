import { describe, expect, it, vi } from "vitest";
import { seedTestLifecycleHandler } from "../../../../convex/seeds/core/seedTestLifecycle";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: async () => "admin",
}));

function fixture() {
  const tables: Record<string, any[]> = {
    users: [{ _id: "admin", isAdmin: true }],
    events: [
      {
        _id: "event",
        name: "Test Hackathon (dev)",
        mode: "hackathon",
        tracks: ["Art", "Health", "College", "Open Hack"],
        categories: [{ name: "Impact", weight: 1 }],
        scoringLockedAt: 1,
      },
    ],
    teams: Array.from({ length: 8 }, (_, i) => ({
      _id: `team-${i}`,
      eventId: "event",
      name: `Team ${i}`,
      track: ["Sustainability", "Health", "Civic Tech", "Open"][i % 4],
    })),
    scores: [
      {
        _id: "existing-score",
        eventId: "event",
        judgeId: "original-judge",
        teamId: "team-0",
        totalScore: 5,
      },
    ],
  };
  let sequence = 0;
  const db = {
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    query: (table: string) => {
      const predicates: Array<(row: any) => boolean> = [];
      const builder = {
        eq: (field: string, value: unknown) => {
          predicates.push((row) => row[field] === value);
          return builder;
        },
      };
      const result = {
        withIndex: (
          _name: string,
          callback: (q: typeof builder) => unknown,
        ) => {
          callback(builder);
          return result;
        },
        filter: (callback: (q: any) => (row: any) => boolean) => {
          predicates.push(
            callback({
              field: (field: string) => field,
              eq: (field: string, value: unknown) => (row: any) =>
                row[field] === value,
            }),
          );
          return result;
        },
        collect: async () =>
          (tables[table] ?? []).filter((row) =>
            predicates.every((p) => p(row)),
          ),
        first: async () => (await result.collect())[0] ?? null,
      };
      return result;
    },
    insert: vi.fn(async (table: string, value: any) => {
      const _id = `${table}-${sequence++}`;
      (tables[table] ??= []).push({ ...value, _id });
      return _id;
    }),
    patch: async (id: string, value: any) => {
      const row = await db.get(id);
      for (const [key, field] of Object.entries(value)) {
        if (field === undefined) delete row[key];
        else row[key] = field;
      }
    },
  };
  return { tables, db };
}

describe("test lifecycle fixtures", () => {
  it("adds prize entries and three scores per team, reopens judging, and preserves existing scores on rerun", async () => {
    const { tables, db } = fixture();
    const first = await seedTestLifecycleHandler({ db } as any, {
      eventId: "event" as any,
      adminUserId: "admin" as any,
      reopen: true,
    });
    expect(first.scoresCreated).toBe(24);
    expect(first.prizesCreated).toBe(10);
    expect(first.entriesCreated).toBeGreaterThan(0);
    expect(first.judgesCreated).toBe(6);
    expect(tables.scores).toContainEqual(
      expect.objectContaining({ _id: "existing-score", totalScore: 5 }),
    );
    expect(tables.events[0].scoringLockedAt).toBeUndefined();
    expect(tables.events[0].enableCohorts).toBe(false);
    expect(tables.events[0].endDate).toBeGreaterThan(Date.now());
    expect(
      tables.teams.every((t) => tables.events[0].tracks.includes(t.track)),
    ).toBe(true);
    expect(tables.users.filter((u) => u.isAdmin)).toHaveLength(1);
    const second = await seedTestLifecycleHandler({ db } as any, {
      eventId: "event" as any,
      adminUserId: "admin" as any,
    });
    expect(second).toMatchObject({
      scoresCreated: 0,
      prizesCreated: 0,
      entriesCreated: 0,
      judgesCreated: 0,
    });
    expect(tables.scores).toHaveLength(25);
    expect(tables.judgeAssignments).toBeUndefined();
  });

  it("refuses to alter another event", async () => {
    const { tables, db } = fixture();
    tables.events[0].name = "DS+X 2026";
    await expect(
      seedTestLifecycleHandler({ db } as any, {
        eventId: "event" as any,
        adminUserId: "admin" as any,
      }),
    ).rejects.toThrow("Only Test Hackathon");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
