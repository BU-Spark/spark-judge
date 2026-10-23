import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthUserId } from "@convex-dev/auth/server";
import { updateEventDetails, verifyJudgeCodeAndStartJudging } from "../../../convex/events";
import { submitBatchScores } from "../../../convex/scores";
import { listTeams } from "../../../convex/teams";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

function queryResult<T>(value: T) {
  return {
    withIndex: () => ({
      eq: () => ({
        eq: () => ({ first: async () => value, collect: async () => value }),
        gte: () => ({ collect: async () => value }),
        first: async () => value,
        collect: async () => value,
      }),
      first: async () => value,
      collect: async () => value,
    }),
  };
}

describe("Convex security handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listTeams shapes and hides rows for a non-admin even when includeHidden is true", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = { _id: "event-1", hidden: false };
    const teams = [
      {
        _id: "team-1",
        eventId: "event-1",
        name: "Visible",
        description: "Project",
        members: ["A"],
        hidden: false,
        entrantEmails: ["a@example.com"],
      },
      {
        _id: "team-2",
        eventId: "event-1",
        name: "Hidden",
        description: "Private",
        members: ["B"],
        hidden: true,
        entrantEmails: ["b@example.com"],
      },
    ];
    const ctx = {
      db: {
        get: vi.fn().mockImplementation((id: string) =>
          id === "event-1" ? event : { _id: id, isAdmin: false },
        ),
        query: vi.fn().mockReturnValue(queryResult(teams)),
      },
    } as any;

    const result = await (listTeams as any)._handler(ctx, {
      eventId: "event-1",
      includeHidden: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: "team-1", name: "Visible" });
    expect(result[0]).not.toHaveProperty("entrantEmails");
  });

  it("rejects duplicate batch score teams before any score write", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = {
      _id: "event-1",
      hidden: false,
      startDate: Date.now() - 1_000,
      endDate: Date.now() + 1_000,
      categories: [{ name: "Innovation", weight: 1 }],
      resultsReleased: false,
      judgeCode: "CURRENT",
    };
    const judge = { _id: "judge-1", userId: "user-1", eventId: "event-1", judgeCodeVerifiedAt: 1 };
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn().mockImplementation((table: string) =>
        table === "judges"
          ? queryResult(judge)
          : queryResult([
              {
                _id: "team-1",
                eventId: "event-1",
                hidden: false,
              },
            ]),
      ),
      insert: vi.fn(),
      patch: vi.fn(),
    };

    await expect(
      (submitBatchScores as any)._handler({ db }, {
        eventId: "event-1",
        scores: [
          { teamId: "team-1", categoryScores: [{ category: "Innovation", score: 5 }] },
          { teamId: "team-1", categoryScores: [{ category: "Innovation", score: 4 }] },
        ],
      }),
    ).rejects.toThrow("duplicate teams");
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("locks an unverified judge after repeated wrong codes and resets on success", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = {
      _id: "event-1",
      hidden: false,
      mode: "hackathon",
      startDate: Date.now() - 1_000,
      endDate: Date.now() + 1_000,
      judgeCode: "CURRENT",
    };
    let committed: any = { _id: "judge-1", userId: "user-1", eventId: "event-1" };
    let patchCount = 0;

    // Models Convex's transaction semantics: writes commit only when the
    // handler returns, and a throw discards them. The earlier version of this
    // test kept writes from throwing calls, which hid a rollback bug.
    async function transaction(judgeCode: string) {
      const pending = structuredClone(committed);
      const db = {
        get: async () => event,
        query: () => ({ withIndex: () => ({ first: async () => pending }) }),
        patch: async (_id: string, updates: any) => {
          patchCount += 1;
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) delete pending[key];
            else pending[key] = value;
          }
        },
      };
      const result = await (verifyJudgeCodeAndStartJudging as any)._handler(
        { db },
        { eventId: "event-1", judgeCode },
      );
      committed = pending;
      return result;
    }

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(transaction("WRONG")).resolves.toMatchObject({
        ok: false,
        code: "invalid_judge_code",
      });
      expect(committed.judgeCodeFailedAttempts).toBe(attempt);
    }
    await expect(transaction("WRONG")).resolves.toMatchObject({
      ok: false,
      code: "judge_code_locked",
      category: "rate_limit",
    });
    expect(committed.judgeCodeLockedUntil).toBeGreaterThan(Date.now());

    // While locked, even the right code is refused without another write.
    const lockedPatchCount = patchCount;
    await expect(transaction("CURRENT")).resolves.toMatchObject({
      ok: false,
      code: "judge_code_locked",
    });
    expect(patchCount).toBe(lockedPatchCount);

    committed.judgeCodeLockedUntil = Date.now() - 1;
    await expect(transaction("WRONG")).resolves.toMatchObject({ ok: false });
    expect(committed.judgeCodeFailedAttempts).toBe(1);
    expect(committed.judgeCodeLockedUntil).toBeUndefined();

    // Codes compare case-insensitively because judges type in uppercase.
    await expect(transaction("current")).resolves.toEqual({ ok: true });
    expect(committed.judgeCodeFailedAttempts).toBeUndefined();
    expect(committed.judgeCodeLockedUntil).toBeUndefined();
    expect(committed.judgeCodeVerifiedAt).toBeTypeOf("number");

    const verifiedPatchCount = patchCount;
    const verifiedState = { ...committed };
    await expect(transaction("WRONG")).resolves.toMatchObject({
      ok: false,
      code: "invalid_judge_code",
    });
    expect(patchCount).toBe(verifiedPatchCount);
    expect(committed).toEqual(verifiedState);
  });

  it("refuses judge verification when the event has no judge code", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = {
      _id: "event-1",
      mode: "hackathon",
      startDate: Date.now() - 1_000,
      endDate: Date.now() + 1_000,
      judgeCode: "",
    };
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn(),
      patch: vi.fn(),
    };
    await expect(
      (verifyJudgeCodeAndStartJudging as any)._handler({ db }, { eventId: "event-1", judgeCode: "" }),
    ).rejects.toThrow("isn't accepting judges yet");
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("admin judge-code rotation clears existing verification state", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("admin-1" as any);
    const event: any = {
      _id: "event-1",
      name: "Event",
      description: "",
      startDate: Date.now() - 1_000,
      endDate: Date.now() + 1_000,
      judgeCode: "CURRENT",
      categories: [],
      resultsReleased: false,
    };
    const judge: any = {
      _id: "judge-1",
      eventId: "event-1",
      judgeCodeVerifiedAt: 1,
      judgeCodeFailedAttempts: 3,
      judgeCodeLockedUntil: Date.now() + 1000,
    };
    const patches: any[] = [];
    const db = {
      get: vi.fn().mockImplementation((id: string) =>
        id === "event-1" ? event : { _id: id, isAdmin: true },
      ),
      query: vi.fn().mockReturnValue({
        withIndex: () => ({ collect: async () => [judge] }),
      }),
      patch: vi.fn().mockImplementation((_id: string, updates: any) => {
        patches.push(updates);
      }),
    };

    await (updateEventDetails as any)._handler(
      { db },
      { eventId: "event-1", judgeCode: "ROTATED" },
    );

    expect(patches).toContainEqual({ judgeCode: "ROTATED" });
    expect(patches).toContainEqual({
      judgeCodeVerifiedAt: undefined,
      judgeCodeFailedAttempts: undefined,
      judgeCodeLockedUntil: undefined,
    });
  });
});
