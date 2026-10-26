import { describe, expect, it } from "vitest";
import { buildFindingDrafts } from "../../../convex/demoDayIntegrity";

const MINUTE = 60 * 1000;
let nextId = 0;

function heart(overrides: Record<string, unknown>) {
  nextId += 1;
  return {
    _id: `a-${nextId}`,
    _creationTime: 0,
    eventId: "event",
    teamId: "team-a",
    attendeeId: "attendee",
    fingerprintKey: "fp",
    ipAddress: "10.0.0.1",
    userAgent: "ua",
    timestamp: 0,
    ...overrides,
  } as any;
}

/** `count` hearts from one voter, one second apart, starting at `start`. */
function session(voter: string, start: number, count: number, extra = {}) {
  return Array.from({ length: count }, (_, index) =>
    heart({ voterUserId: voter, timestamp: start + index * 1000, ...extra }),
  );
}

function draftsOfType(rows: any[], type: string) {
  return buildFindingDrafts(rows).filter((draft) => draft.type === type);
}

describe("identity cycling detector", () => {
  it("flags follow-up identities on one device and keeps the first", () => {
    const first = session("v1", 0, 10);
    const second = session("v2", 1 * MINUTE, 10);
    const third = session("v3", 2 * MINUTE, 10);
    const [draft] = draftsOfType([...first, ...second, ...third], "identity_cycling");

    expect(draft).toBeDefined();
    const flagged = new Set(draft.affectedAppreciationIds);
    expect(first.some((row) => flagged.has(row._id))).toBe(false);
    expect([...second, ...third].every((row) => flagged.has(row._id))).toBe(true);
  });

  it("ignores two identities, which friends sharing a phone model can produce", () => {
    const rows = [...session("v1", 0, 10), ...session("v2", 1 * MINUTE, 10)];
    expect(draftsOfType(rows, "identity_cycling")).toHaveLength(0);
  });

  it("does not chain identities separated by more than the gap", () => {
    const rows = [
      ...session("v1", 0, 10),
      ...session("v2", 10 * MINUTE, 10),
      ...session("v3", 20 * MINUTE, 10),
    ];
    expect(draftsOfType(rows, "identity_cycling")).toHaveLength(0);
  });

  it("treats different projects on one device independently", () => {
    const rows = [
      ...session("v1", 0, 10, { teamId: "team-a" }),
      ...session("v2", 1 * MINUTE, 10, { teamId: "team-b" }),
      ...session("v3", 2 * MINUTE, 10, { teamId: "team-c" }),
    ];
    expect(draftsOfType(rows, "identity_cycling")).toHaveLength(0);
  });
});

describe("IP rotation detector", () => {
  it("flags one device voting for one project from many networks", () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      session(`v${index}`, index * MINUTE, 2, { ipAddress: `198.51.100.${index}` }),
    ).flat();
    const [draft] = draftsOfType(rows, "ip_rotation");
    expect(draft?.summary).toContain("5 networks");
  });

  it("allows a phone switching between wifi and cellular", () => {
    const rows = [
      ...session("v1", 0, 5, { ipAddress: "128.197.0.1" }),
      ...session("v1", 1 * MINUTE, 5, { ipAddress: "2600:387::1" }),
    ];
    expect(draftsOfType(rows, "ip_rotation")).toHaveLength(0);
  });
});

describe("burst windows", () => {
  it("finds a burst after the event ended, not only in the last minutes", () => {
    // One burst early in a long event; a scan hours later must still see it.
    const burst = Array.from({ length: 10 }, (_, index) =>
      session(`v${index}`, index * 1000, 2),
    ).flat();
    const lateQuietHeart = heart({ voterUserId: "late", timestamp: 180 * MINUTE });
    expect(draftsOfType([...burst, lateQuietHeart], "ip_ua_burst")).toHaveLength(1);
  });

  it("counts signed-in voters, not client attendee IDs", () => {
    // Many attendee IDs from one account is one voter, not a crowd.
    const rows = Array.from({ length: 24 }, (_, index) =>
      heart({ voterUserId: "same-account", attendeeId: `id-${index}`, timestamp: index * 1000 }),
    );
    expect(draftsOfType(rows, "ip_ua_burst")).toHaveLength(0);
    expect(draftsOfType(rows, "high_velocity")).toHaveLength(1);
  });

  it("skips rejected hearts", () => {
    const rows = session("v1", 0, 20).map((row) => ({ ...row, reviewStatus: "rejected" }));
    expect(buildFindingDrafts(rows)).toHaveLength(0);
  });
});
