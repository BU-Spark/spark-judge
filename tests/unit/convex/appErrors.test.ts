import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";

import { getAuthUserId } from "@convex-dev/auth/server";
import { saveBallot } from "../../../convex/codeAndTell";
import {
  createEventWithPrizes,
  joinAsJudge,
  setScoringLock,
  updateJudgingSettings,
  verifyJudgeCodeAndStartJudging,
} from "../../../convex/events";
import { submitBatchScores } from "../../../convex/scores";
import { generateUploadUrl, saveMyProject } from "../../../convex/teams";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

/** Resolves every index/range chain to `value`, matching handler query shapes. */
function queryResult<T>(value: T) {
  const terminal: any = {
    first: async () => (Array.isArray(value) ? value[0] ?? null : value),
    collect: async () => (Array.isArray(value) ? value : value ? [value] : []),
  };
  const chain: any = new Proxy(terminal, {
    get: (target, prop) => (prop in target ? target[prop] : () => chain),
  });
  return { withIndex: () => chain };
}

async function rejectionData(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<any>).data;
  }
  throw new Error("Expected the handler to reject");
}

const activeWindow = () => ({ startDate: Date.now() - 1_000, endDate: Date.now() + 60_000 });

describe("typed application errors from user-facing mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saveMyProject rejects a signed-out caller with an authentication error", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const data = await rejectionData(
      (saveMyProject as any)._handler({ db: {} }, { eventId: "event-1", description: "", members: [] }),
    );
    expect(data).toEqual({
      code: "not_authenticated",
      category: "authentication",
      message: "Not authenticated",
    });
  });

  it("saveMyProject reports a duplicate project name as a conflict", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = { _id: "event-1", mode: "hackathon", tracks: ["Web"], categories: [], ...activeWindow() };
    // Team lookups in order: the caller's own project (twice, none), then all
    // teams in the event for the duplicate-name check.
    let teamLookups = 0;
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn().mockImplementation((table: string) => {
        if (table !== "teams") return queryResult(null);
        teamLookups += 1;
        return queryResult(teamLookups < 3 ? null : [{ _id: "team-9", name: "Rocket", hidden: false }]);
      }),
      insert: vi.fn(),
    };
    const data = await rejectionData(
      (saveMyProject as any)._handler({ db }, {
        eventId: "event-1",
        name: "rocket",
        description: "",
        members: ["A"],
        track: "Web",
        githubUrl: "https://github.com/a/b",
      }),
    );
    expect(data).toEqual({
      code: "duplicate_team_name",
      category: "conflict",
      message: "A team with this name already exists for this event",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("generateUploadUrl rejects inactive events with a lifecycle error", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = { _id: "event-1", startDate: Date.now() - 10_000, endDate: Date.now() - 5_000 };
    const ctx = { db: { get: vi.fn().mockResolvedValue(event) }, storage: { generateUploadUrl: vi.fn() } };
    const data = await rejectionData((generateUploadUrl as any)._handler(ctx, { eventId: "event-1" }));
    expect(data).toMatchObject({ code: "uploads_closed", category: "lifecycle" });
    expect(ctx.storage.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("submitBatchScores reports a scoring lock as a lifecycle error", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = { _id: "event-1", mode: "hackathon", judgeCode: "CURRENT", scoringLockedAt: 1, categories: [], ...activeWindow() };
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn().mockReturnValue(queryResult({ _id: "judge-1", judgeCodeVerifiedAt: 1 })),
    };
    const data = await rejectionData((submitBatchScores as any)._handler({ db }, { eventId: "event-1", scores: [] }));
    expect(data).toEqual({
      code: "scoring_locked",
      category: "lifecycle",
      message: "Scoring is locked for this event",
    });
  });

  it("saveBallot reports a reached ballot cap as a lifecycle error", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = {
      _id: "event-1",
      mode: "code_and_tell",
      codeAndTellPhase: "voting",
      codeAndTellMaxBallots: 1,
      ...activeWindow(),
    };
    const teams = [{ _id: "team-1", name: "One", entrantEmails: [] }];
    // The first rankedVotes lookup is the caller's own ballot (none); the
    // second counts all ballots for the cap.
    let rankedVoteLookups = 0;
    const db = {
      get: vi.fn().mockImplementation(async (id: string) =>
        id === "event-1" ? event : { _id: id, email: "voter@example.com" },
      ),
      query: vi.fn().mockImplementation((table: string) => {
        if (table === "teams") return queryResult(teams);
        if (table === "rankedVotes") {
          rankedVoteLookups += 1;
          return queryResult(rankedVoteLookups === 1 ? [] : [{ _id: "vote-1" }]);
        }
        return queryResult(null);
      }),
      insert: vi.fn(),
    };
    const data = await rejectionData(
      (saveBallot as any)._handler({ db }, { eventId: "event-1", rankedTeamIds: ["team-1"] }),
    );
    expect(data).toEqual({
      code: "ballot_cap_reached",
      category: "lifecycle",
      message: "This event has reached its voting limit.",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("joinAsJudge reports an existing participant as a conflict", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const db = {
      get: vi.fn().mockResolvedValue({ _id: "event-1", mode: "hackathon" }),
      query: vi.fn().mockReturnValue(queryResult({ _id: "participant-1" })),
    };
    const data = await rejectionData((joinAsJudge as any)._handler({ db }, { eventId: "event-1" }));
    expect(data).toEqual({
      code: "already_participant",
      category: "conflict",
      message: "You are already a participant for this event",
    });
  });

  it("verifyJudgeCodeAndStartJudging returns lockout and wrong-code categories", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event = { _id: "event-1", mode: "hackathon", judgeCode: "CURRENT", ...activeWindow() };
    const judge: any = { _id: "judge-1", judgeCodeLockedUntil: Date.now() + 60_000 };
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn().mockReturnValue(queryResult(judge)),
      patch: vi.fn(),
    };
    // Lockout and wrong codes are returned, not thrown, so the attempt
    // counter survives; the result keeps the typed-error shape.
    const locked = await (verifyJudgeCodeAndStartJudging as any)._handler(
      { db },
      { eventId: "event-1", judgeCode: "CURRENT" },
    );
    expect(locked).toMatchObject({
      ok: false,
      code: "judge_code_locked",
      category: "rate_limit",
    });
    expect(locked.retryAfterMs).toBeGreaterThan(0);
    expect(locked.retryAfterMs).toBeLessThanOrEqual(60_000);
    expect(db.patch).not.toHaveBeenCalled();

    judge.judgeCodeLockedUntil = undefined;
    const wrong = await (verifyJudgeCodeAndStartJudging as any)._handler(
      { db },
      { eventId: "event-1", judgeCode: "WRONG" },
    );
    expect(wrong).toEqual({
      ok: false,
      code: "invalid_judge_code",
      category: "verification",
      message: "Invalid judge code",
    });
    expect(db.patch).toHaveBeenCalledWith(
      "judge-1",
      expect.objectContaining({ judgeCodeFailedAttempts: 1 }),
    );
  });

  it("verifyJudgeCodeAndStartJudging lets judges check in before the event starts but not after it ends", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const event: any = {
      _id: "event-1",
      mode: "hackathon",
      judgeCode: "CURRENT",
      startDate: Date.now() + 60_000,
      endDate: Date.now() + 120_000,
    };
    const judge: any = { _id: "judge-1" };
    const db = {
      get: vi.fn().mockResolvedValue(event),
      query: vi.fn().mockReturnValue(queryResult(judge)),
      patch: vi.fn(),
    };
    const early = await (verifyJudgeCodeAndStartJudging as any)._handler(
      { db },
      { eventId: "event-1", judgeCode: "CURRENT" },
    );
    expect(early).toEqual({ ok: true });
    expect(db.patch).toHaveBeenCalledWith(
      "judge-1",
      expect.objectContaining({ judgeCodeVerifiedAt: expect.any(Number) }),
    );

    event.startDate = Date.now() - 120_000;
    event.endDate = Date.now() - 60_000;
    const ended = await rejectionData(
      (verifyJudgeCodeAndStartJudging as any)._handler(
        { db },
        { eventId: "event-1", judgeCode: "CURRENT" },
      ),
    );
    expect(ended).toMatchObject({ code: "event_ended", category: "lifecycle" });
  });

  it("admin event mutations reject non-admins and invalid input with typed errors", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user-1" as any);
    const nonAdminDb = { get: vi.fn().mockResolvedValue({ _id: "user-1", isAdmin: false }) };
    const denied = await rejectionData(
      (setScoringLock as any)._handler({ db: nonAdminDb }, { eventId: "event-1", locked: true }),
    );
    expect(denied).toMatchObject({ code: "admin_required", category: "permission" });

    const adminDb = {
      get: vi.fn().mockImplementation(async (id: string) =>
        id === "user-1" ? { _id: "user-1", isAdmin: true } : { _id: id, mode: "hackathon", scoringLockedAt: 1 },
      ),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const badDates = await rejectionData(
      (createEventWithPrizes as any)._handler({ db: adminDb }, {
        name: "Event",
        status: "upcoming",
        startDate: 10,
        endDate: 5,
        categories: [],
        prizes: [],
      }),
    );
    expect(badDates).toEqual({
      code: "invalid_date_range",
      category: "validation",
      message: "End date must be after start date",
    });
    expect(adminDb.insert).not.toHaveBeenCalled();

    const lockedSettings = await rejectionData(
      (updateJudgingSettings as any)._handler({ db: adminDb }, {
        eventId: "event-1",
        categories: [{ name: "Impact", weight: 1 }],
        enableCohorts: false,
        judgeCode: null,
      }),
    );
    expect(lockedSettings).toEqual({
      code: "scoring_locked",
      category: "lifecycle",
      message: "Judging settings are locked while scoring is locked",
    });
    expect(adminDb.patch).not.toHaveBeenCalled();
  });
});
