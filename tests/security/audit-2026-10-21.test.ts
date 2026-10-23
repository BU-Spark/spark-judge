/**
 * Opt-in evidence for security_best_practices_report_2026-10-21.md.
 * The remaining test demonstrates a known weakness, NOT a security guarantee.
 * Run: SECURITY_AUDIT_REPRO=1 npm test -- tests/security/audit-2026-10-21.test.ts
 * No network, deployed backend, credentials, or real event data are used.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUserId } from "@convex-dev/auth/server";
import { evaluateAppreciationRequest } from "../../convex/demoDayIntegrity";

vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));

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
    _id: "event", mode: "demo_day", hidden: false,
    startDate: Date.now() - 60_000, endDate: Date.now() + 60_000,
    ...overrides,
  };
}

describe.skipIf(process.env.SECURITY_AUDIT_REPRO !== "1")("2026-10-21 audit reproductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthUserId).mockResolvedValue("voter" as any);
  });

  // AUD-01, AUD-02, AUD-03, and AUD-06 are fixed; their secure behavior is
  // asserted in tests/unit/convex/securityRegressions.test.ts and
  // tests/unit/convex/handlerSecurity.test.ts. AUD-05 remains a documented,
  // accepted weakness: browser location is a risk signal, not proof.

  it("AUD-05: forged coordinates suppress location rechecks for an existing CAPTCHA pass", async () => {
    const event = activeEvent({ venueLocationEnabled: true, venueLatitude: 42, venueLongitude: -71, venueRadiusMeters: 100 });
    const pass = { _id: "pass", expiresAt: Date.now() + 60_000, ipAddress: "192.0.2.1", userAgent: "audit" };
    const ctx = { db: {
      get: async () => event,
      query: (table: string) => queryResult(table === "demoDayCaptchaPasses" ? [pass] : []),
      patch: vi.fn(),
    } };
    const args = { eventId: "event", voterUserId: "voter", attendeeId: "browser", fingerprintKey: "fp", ipAddress: "192.0.2.1", userAgent: "audit", captchaVerified: false };
    const denied = await (evaluateAppreciationRequest as any)._handler(ctx, { ...args, location: { status: "denied" } });
    expect(denied.requiresCaptcha).toBe(true);
    const forged = await (evaluateAppreciationRequest as any)._handler(ctx, {
      ...args, location: { status: "in_range", latitude: 42, longitude: -71, accuracyMeters: 1 },
      clientSignals: { webdriver: false, isLikelyMobile: true },
    });
    expect(forged).toMatchObject({ allowed: true, requiresCaptcha: false, riskScore: 0 });
  });

});
