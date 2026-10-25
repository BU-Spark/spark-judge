import { describe, expect, it, vi } from "vitest";
import { seedJudgeTutorialHandler, TUTORIAL_NAME } from "../../../../convex/seeds/core/seedJudgeTutorial";

function fixture(existing?: any) {
  const tables: Record<string, any[]> = {
    events: existing ? [existing] : [{ _id: "real-event", name: "DS+X 2026", tracks: ["Art", "Health"], categories: [{ name: "Impact", weight: 1 }] }],
    users: [{ _id: "admin", isAdmin: true }],
  };
  let sequence = 0;
  const db = {
    query(table: string) {
      let predicate = (_row: any) => true;
      return {
        filter(callback: any) {
          predicate = callback({ field: (f: string) => f, eq: (f: string, v: any) => (row: any) => row[f] === v });
          return this;
        },
        first: async () => (tables[table] ?? []).find(predicate) ?? null,
      };
    },
    insert: vi.fn(async (table: string, value: any) => {
      const _id = `${table}-${sequence++}`;
      (tables[table] ??= []).push({ ...value, _id });
      return _id;
    }),
  };
  return { tables, db };
}

describe("private judge tutorial", () => {
  it("creates a live admin-only event with fresh teams, valid tracks, prize entries and no scores; reruns preserve practice", async () => {
    const { tables, db } = fixture();
    const original = structuredClone(tables.events[0]);
    const result = await seedJudgeTutorialHandler({ db } as any);
    const event = tables.events.find(e => e._id === result.eventId);
    expect(event).toMatchObject({ name: TUTORIAL_NAME, hidden: true, status: "active", enableCohorts: false, resultsReleased: false });
    expect(event.startDate).toBeLessThan(Date.now());
    expect(event.endDate).toBeGreaterThan(Date.now());
    expect(tables.teams).toHaveLength(10);
    expect(tables.teams.every(t => t.eventId === event._id && event.tracks.includes(t.track))).toBe(true);
    expect(tables.prizes).toHaveLength(2);
    expect(tables.teamPrizeSubmissions).toHaveLength(5);
    expect(tables.scores).toBeUndefined();
    expect(tables.events[0]).toEqual(original);
    db.insert.mockClear();
    expect(await seedJudgeTutorialHandler({ db } as any)).toEqual({ eventId: event._id, created: false });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("refuses an existing visible event with the same name", async () => {
    const { db } = fixture({ _id: "existing", name: TUTORIAL_NAME, hidden: false, mode: "hackathon" });
    await expect(seedJudgeTutorialHandler({ db } as any)).rejects.toThrow("Review the existing tutorial");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
