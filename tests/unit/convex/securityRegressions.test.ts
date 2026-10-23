/**
 * Regression coverage for fixes from the 2026-10-21 security audit. Handlers
 * run against mocked auth and database objects, not a real Convex runtime.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getFunctionName } from "convex/server";
import { createAppreciationInternal } from "../../../convex/appreciations";
import {
  evaluateAppreciationRequest,
  recordCaptchaFailure,
} from "../../../convex/demoDayIntegrity";
import {
  addMultipleTeamsToAssignment,
  addTeamToAssignment,
} from "../../../convex/judgeAssignments";
import http, { parseAppreciationRequestBody } from "../../../convex/http";
import { joinAsJudge } from "../../../convex/events";
import { submitBatchScores, validateCategoryScores } from "../../../convex/scores";
import { listPrizeWinners } from "../../../convex/prizes";
import {
  generateUploadUrl,
  getMyTeam,
  LOGO_UPLOADS_PER_WINDOW,
  saveMyProject,
} from "../../../convex/teams";

vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));
vi.mock("../../../convex/auth", () => ({ auth: { addHttpRoutes: vi.fn() } }));

function queryResult(rows: any[] = []) {
  const result = {
    withIndex: () => result,
    order: () => result,
    first: async () => rows[0] ?? null,
    collect: async () => rows,
    take: async (n: number) => rows.slice(0, n),
  };
  return result;
}

function activeEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: "event",
    mode: "demo_day",
    hidden: false,
    startDate: Date.now() - 60_000,
    endDate: Date.now() + 60_000,
    ...overrides,
  };
}

const baseIntegrityArgs = {
  eventId: "event",
  voterUserId: "voter",
  attendeeId: "browser",
  fingerprintKey: "fp",
  ipAddress: "192.0.2.1",
  userAgent: "test",
  captchaVerified: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUserId).mockResolvedValue("voter" as any);
});

describe("Demo Day appreciation request validation", () => {
  const valid = {
    eventId: "event",
    teamId: "team",
    attendeeId: "browser",
    fingerprintKey: "fp",
  };

  it("accepts a well-formed body", () => {
    expect(parseAppreciationRequestBody(valid)).toEqual(valid);
  });

  it("rejects missing, non-string, and oversized identifiers", () => {
    expect(parseAppreciationRequestBody(null)).toBeNull();
    expect(parseAppreciationRequestBody({ ...valid, teamId: 7 })).toBeNull();
    expect(
      parseAppreciationRequestBody({ ...valid, fingerprintKey: "x".repeat(129) }),
    ).toBeNull();
    expect(
      parseAppreciationRequestBody({ ...valid, attendeeId: "x".repeat(100_000) }),
    ).toBeNull();
    expect(
      parseAppreciationRequestBody({ ...valid, turnstileToken: "x".repeat(5000) }),
    ).toBeNull();
  });

  it("drops out-of-range coordinates and negative accuracy", () => {
    const parsed = parseAppreciationRequestBody({
      ...valid,
      location: { status: "in_range", latitude: 420, longitude: -71, accuracyMeters: -5 },
    });
    expect(parsed?.location).toEqual({ status: "in_range" });
  });

  it("keeps only known client signal fields with valid types", () => {
    const parsed = parseAppreciationRequestBody({
      ...valid,
      clientSignals: { webdriver: "no", isLikelyMobile: true, extra: "x", language: "en-US" },
    });
    expect(parsed?.clientSignals).toEqual({ isLikelyMobile: true, language: "en-US" });
  });
});

describe("Demo Day hidden events", () => {
  it("rejects votes on a hidden event over HTTP without writing anything", async () => {
    const event = activeEvent({ hidden: true });
    const team = { _id: "team", eventId: "event", hidden: false, rawScore: 0 };
    const db = {
      get: vi.fn(async (id: string) => (id === "event" ? event : id === "team" ? team : null)),
      query: vi.fn(() => queryResult()),
      insert: vi.fn(async () => "row"),
      patch: vi.fn(),
    };
    const ctx = {
      db,
      runMutation: async (ref: any, args: any) => {
        const name = getFunctionName(ref);
        if (name === "demoDayIntegrity:evaluateAppreciationRequest") {
          return (evaluateAppreciationRequest as any)._handler({ db }, args);
        }
        if (name === "appreciations:createAppreciationInternal") {
          return (createAppreciationInternal as any)._handler({ db }, args);
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
    };
    const route = http.lookup("/demo-day/appreciations", "POST")![0] as any;
    const response = await route._handler(
      ctx,
      new Request("https://test.invalid/demo-day/appreciations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: "event", teamId: "team", attendeeId: "browser", fingerprintKey: "fp" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body).not.toHaveProperty("integrity");
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("rejects hidden events in the final appreciation write", async () => {
    const db = {
      get: vi.fn(async () => activeEvent({ hidden: true })),
      query: vi.fn(() => queryResult()),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const result = await (createAppreciationInternal as any)._handler({ db }, {
      ...baseIntegrityArgs,
      teamId: "team",
    });
    expect(result.success).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not evaluate or record CAPTCHA state for inactive events", async () => {
    const db = {
      get: vi.fn(async () => activeEvent({ captchaEnabled: true, endDate: Date.now() - 1000 })),
      query: vi.fn(() => queryResult()),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const result = await (evaluateAppreciationRequest as any)._handler({ db }, baseIntegrityArgs);
    expect(result).toMatchObject({ allowed: false, requiresCaptcha: false });
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("Demo Day CAPTCHA failure rows", () => {
  it("stops inserting rows once a voter reaches the per-event cap", async () => {
    const existing = Array.from({ length: 5 }, (_, index) => ({
      _id: `pass-${index}`,
      failureCount: 1,
      riskScore: 20,
      riskReasons: [],
    }));
    const db = {
      // The exact-fingerprint lookup misses; the per-voter lookup sees 5 rows.
      query: vi
        .fn()
        .mockReturnValueOnce(queryResult([]))
        .mockReturnValueOnce(queryResult(existing)),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    await (recordCaptchaFailure as any)._handler({ db }, {
      ...baseIntegrityArgs,
      fingerprintKey: "fresh-random-key",
      failureReason: "verification_failed",
    });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).toHaveBeenCalledWith(
      "pass-0",
      expect.objectContaining({ failureCount: 2, recheckRequired: true }),
    );
  });

  it("still records a first failure for a new fingerprint under the cap", async () => {
    const db = {
      query: vi.fn(() => queryResult([])),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    await (recordCaptchaFailure as any)._handler({ db }, {
      ...baseIntegrityArgs,
      failureReason: "verification_failed",
    });
    expect(db.insert).toHaveBeenCalledWith(
      "demoDayCaptchaPasses",
      expect.objectContaining({ failureCount: 1 }),
    );
  });
});

describe("Demo Day shared-network limit", () => {
  it("flags rather than refuses votes once a network passes the limit", async () => {
    const team = { _id: "team", eventId: "event", hidden: false, rawScore: 0, cleanScore: 0 };
    const ipRows = Array.from({ length: 100 }, (_, index) => ({ _id: `a-${index}` }));
    const db = {
      get: vi.fn(async (id: string) => (id === "event" ? activeEvent() : team)),
      // Per-team and per-voter budgets are empty; the IP window is full.
      query: vi
        .fn()
        .mockReturnValueOnce(queryResult([]))
        .mockReturnValueOnce(queryResult([]))
        .mockReturnValueOnce(queryResult(ipRows)),
      insert: vi.fn(async () => "appreciation"),
      patch: vi.fn(),
    };
    const result = await (createAppreciationInternal as any)._handler({ db }, {
      ...baseIntegrityArgs,
      teamId: "team",
      reviewStatus: "accepted",
    });
    expect(result.success).toBe(true);
    expect(db.insert).toHaveBeenCalledWith(
      "appreciations",
      expect.objectContaining({
        reviewStatus: "flagged",
        riskReasons: ["ip_rate_limit"],
      }),
    );
  });
});

describe("Judge self-assignment", () => {
  const hackathon = activeEvent({ mode: "hackathon", judgeCode: "JUDGE-2026" });
  const judge = { _id: "judge", userId: "voter", eventId: "event", judgeCodeVerifiedAt: 1 };
  const user = { _id: "voter", email: "Judge@Example.com" };
  const ownTeam = { _id: "own", eventId: "event", entrantEmails: ["judge@example.com"] };
  const submittedTeam = { _id: "submitted", eventId: "event", submittedBy: "voter" };
  const otherTeam = { _id: "other", eventId: "event", entrantEmails: ["someone@example.com"] };
  const records: Record<string, any> = {
    event: hackathon,
    voter: user,
    own: ownTeam,
    submitted: submittedTeam,
    other: otherTeam,
  };

  function makeDb() {
    return {
      get: vi.fn(async (id: string) => records[id] ?? null),
      query: vi.fn((table: string) => queryResult(table === "judges" ? [judge] : [])),
      insert: vi.fn(async () => "assignment"),
    };
  }

  it("rejects assigning a team the judge belongs to", async () => {
    const db = makeDb();
    for (const teamId of ["own", "submitted"]) {
      await expect(
        (addTeamToAssignment as any)._handler({ db }, { eventId: "event", teamId }),
      ).rejects.toThrow("You cannot judge a project you are part of");
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("skips own teams in bulk assignment", async () => {
    const db = makeDb();
    const added = await (addMultipleTeamsToAssignment as any)._handler({ db }, {
      eventId: "event",
      teamIds: ["own", "other", "submitted"],
    });
    expect(added).toBe(1);
    expect(db.insert).toHaveBeenCalledWith(
      "judgeAssignments",
      expect.objectContaining({ teamId: "other" }),
    );
  });
});

describe("Judges on their own projects", () => {
  const event = activeEvent({ mode: "hackathon", judgeCode: "JUDGE-2026", categories: [{ name: "Impact", weight: 1 }] });
  const user = { _id: "voter", email: "member@example.com" };
  const ownTeam = { _id: "own", eventId: "event", hidden: false, entrantEmails: ["Member@Example.com"] };
  const otherTeam = { _id: "other", eventId: "event", hidden: false, entrantEmails: [] };

  it("refuses judge registration for a listed teammate who never submitted", async () => {
    const db = {
      get: vi.fn(async (id: string) => (id === "event" ? event : id === "voter" ? user : null)),
      query: vi.fn((table: string) => queryResult(table === "teams" ? [otherTeam, ownTeam] : [])),
      insert: vi.fn(),
    };
    await expect(
      (joinAsJudge as any)._handler({ db }, { eventId: "event" }),
    ).rejects.toThrow("so you can't judge it");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("refuses scores for the judge's own team", async () => {
    const judge = { _id: "judge", userId: "voter", eventId: "event", judgeCodeVerifiedAt: 1 };
    const db = {
      get: vi.fn(async (id: string) => (id === "event" ? event : id === "voter" ? user : null)),
      query: vi.fn((table: string) =>
        queryResult(table === "judges" ? [judge] : table === "teams" ? [otherTeam, ownTeam] : []),
      ),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    await expect(
      (submitBatchScores as any)._handler({ db }, {
        eventId: "event",
        scores: [{ teamId: "own", categoryScores: [{ category: "Impact", score: 5 }] }],
      }),
    ).rejects.toThrow("You cannot score a project you are part of");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects score sheets where every weighted category is opted out", () => {
    const categories = [
      { name: "Impact", weight: 2, optOutAllowed: true },
      { name: "Design", weight: 1, optOutAllowed: true },
    ];
    expect(() =>
      validateCategoryScores(
        [
          { category: "Impact", score: null, optedOut: true },
          { category: "Design", score: null, optedOut: true },
        ],
        categories,
      ),
    ).toThrow("Score at least one weighted category");
    expect(() =>
      validateCategoryScores(
        [
          { category: "Impact", score: 4 },
          { category: "Design", score: null, optedOut: true },
        ],
        categories,
      ),
    ).not.toThrow();
  });
});

describe("Project logo uploads", () => {
  const event = activeEvent({ mode: "hackathon", tracks: ["General"], categories: [] });

  function uploadDb(recentIssuances: number) {
    return {
      get: vi.fn(async () => event),
      query: vi.fn((table: string) => {
        if (table === "judges") return queryResult([]);
        return queryResult(
          Array.from({ length: recentIssuances }, (_, index) => ({
            _id: `issue-${index}`,
            issuedAt: Date.now() - 1000,
          })),
        );
      }),
      insert: vi.fn(),
      delete: vi.fn(),
    };
  }

  it("rate-limits upload URL issuance per user", async () => {
    const storage = { generateUploadUrl: vi.fn(async () => "https://upload.invalid") };
    const db = uploadDb(LOGO_UPLOADS_PER_WINDOW);
    await expect(
      (generateUploadUrl as any)._handler({ db, storage }, { eventId: "event" }),
    ).rejects.toThrow("Too many logo uploads");
    expect(storage.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("records each issued upload URL", async () => {
    const storage = { generateUploadUrl: vi.fn(async () => "https://upload.invalid") };
    const db = uploadDb(0);
    await expect(
      (generateUploadUrl as any)._handler({ db, storage }, { eventId: "event" }),
    ).resolves.toBe("https://upload.invalid");
    expect(db.insert).toHaveBeenCalledWith(
      "logoUploadIssuances",
      expect.objectContaining({ userId: "voter", eventId: "event" }),
    );
  });

  function projectDb(file: Record<string, unknown> | null, logoOwner: unknown = null) {
    const team = { _id: "team", eventId: "event", submittedBy: "voter", logoStorageId: "old-logo" };
    return {
      team,
      db: {
        get: vi.fn(async (id: string) => (id === "event" ? event : id === "team" ? team : null)),
        query: vi.fn((table: string) => queryResult(table === "teams" ? (logoOwner ? [logoOwner] : []) : [])),
        system: { get: vi.fn(async (id: string) => (id === "old-logo" ? { _id: id } : file)) },
        patch: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
      },
      storage: { delete: vi.fn() },
    };
  }

  const saveArgs = {
    eventId: "event",
    teamId: "team",
    description: "Updated",
    members: ["Member"],
    logoStorageId: "new-logo",
  };

  it("rejects attaching a non-image, oversized, expired, or borrowed upload", async () => {
    const cases: Array<[Record<string, unknown> | null, unknown, string]> = [
      [{ contentType: "image/svg+xml", size: 100 }, null, "PNG, JPEG, WebP, or GIF"],
      [{ contentType: "text/html", size: 100 }, null, "PNG, JPEG, WebP, or GIF"],
      [{ contentType: "image/png", size: 6 * 1024 * 1024 }, null, "5 MB or smaller"],
      [null, null, "has expired"],
      [{ contentType: "image/png", size: 100 }, { _id: "someone-else" }, "belongs to another project"],
    ];
    for (const [file, owner, message] of cases) {
      const { db, storage } = projectDb(file, owner);
      await expect(
        (saveMyProject as any)._handler({ db, storage }, saveArgs),
      ).rejects.toThrow(message);
      expect(db.patch).not.toHaveBeenCalled();
    }
  });

  it("attaches a valid image and deletes the replaced logo", async () => {
    const { db, storage } = projectDb({ contentType: "image/png", size: 1000 });
    await (saveMyProject as any)._handler({ db, storage }, saveArgs);
    expect(db.patch).toHaveBeenCalledWith(
      "team",
      expect.objectContaining({ logoStorageId: "new-logo" }),
    );
    expect(storage.delete).toHaveBeenCalledWith("old-logo");
  });

  it("rejects project edits once scoring is locked", async () => {
    const { db, storage } = projectDb({ contentType: "image/png", size: 1000 });
    db.get.mockImplementation((async (id: string) =>
      id === "event" ? { ...event, scoringLockedAt: 1 } : { _id: "team", eventId: "event", submittedBy: "voter" }) as any);
    await expect(
      (saveMyProject as any)._handler({ db, storage }, { ...saveArgs, logoStorageId: undefined }),
    ).rejects.toThrow("scoring is locked");
    expect(db.patch).not.toHaveBeenCalled();
  });
});

describe("Entrant and public read shapes", () => {
  it("does not return live Demo Day tallies or storage IDs to the submitter", async () => {
    const team = {
      _id: "team",
      eventId: "event",
      name: "Garden",
      description: "",
      members: [],
      submittedBy: "voter",
      rawScore: 40,
      cleanScore: 12,
      flagged: true,
      logoStorageId: "logo",
      entrantEmails: ["a@example.com"],
      airtableProjectRecordId: "rec123",
    };
    const db = {
      get: vi.fn(async () => activeEvent()),
      query: vi.fn(() => queryResult([team])),
    };
    const storage = { getUrl: vi.fn(async () => "https://logo.invalid") };
    const result = await (getMyTeam as any)._handler({ db, storage }, { eventId: "event" });
    expect(result).toMatchObject({ _id: "team", name: "Garden", logoUrl: "https://logo.invalid" });
    for (const field of ["rawScore", "cleanScore", "flagged", "logoStorageId", "entrantEmails", "airtableProjectRecordId"]) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("omits hidden teams and inactive prizes from released public winners", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const event = activeEvent({ mode: "hackathon", resultsReleased: true });
    const rows: Record<string, any[]> = {
      prizeWinners: [
        { _id: "w1", eventId: "event", prizeId: "best", teamId: "visible" },
        { _id: "w2", eventId: "event", prizeId: "best", teamId: "hidden" },
        { _id: "w3", eventId: "event", prizeId: "retired", teamId: "visible" },
      ],
      prizes: [
        { _id: "best", name: "Best", isActive: true },
        { _id: "retired", name: "Retired", isActive: false },
      ],
      teams: [
        { _id: "visible", eventId: "event", name: "Shown", members: [] },
        { _id: "hidden", eventId: "event", name: "Withdrawn", hidden: true, members: [] },
      ],
    };
    const result = await (listPrizeWinners as any)._handler(
      { db: { get: async () => event, query: (table: string) => queryResult(rows[table]) } },
      { eventId: "event" },
    );
    expect(result.map((winner: any) => winner._id)).toEqual(["w1"]);
  });
});
