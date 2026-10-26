import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { computeEventStatus, requireAdmin } from "./helpers";
import { isDemoDayMode } from "./eventModes";

const REVIEW_STATUS_VALIDATOR = v.union(
  v.literal("accepted"),
  v.literal("flagged"),
  v.literal("rejected"),
);

const LOCATION_STATUS_VALIDATOR = v.union(
  v.literal("in_range"),
  v.literal("out_of_range"),
  v.literal("denied"),
  v.literal("unavailable"),
  v.literal("inaccurate"),
  v.literal("unknown"),
);

const LOCATION_PAYLOAD_VALIDATOR = v.optional(
  v.object({
    status: LOCATION_STATUS_VALIDATOR,
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
  }),
);

const CLIENT_SIGNALS_VALIDATOR = v.optional(
  v.object({
    webdriver: v.optional(v.boolean()),
    isLikelyMobile: v.optional(v.boolean()),
    userAgentDataMobile: v.optional(v.boolean()),
    viewportWidth: v.optional(v.number()),
    viewportHeight: v.optional(v.number()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  }),
);

const PASS_TTL_MS = 12 * 60 * 60 * 1000;
const POST_EVENT_SCAN_WINDOW_MS = 2 * 60 * 60 * 1000;
const VELOCITY_WINDOW_MS = 60 * 1000;
const VELOCITY_RECHECK_COUNT = 12;
const RECHECK_RISK_SCORE = 60;
const FLAG_RISK_SCORE = 70;
const IP_PASS_BURST_COUNT = 15;
const SHARED_DEVICE_WINDOW_MS = 10 * 60 * 1000;
const SHARED_DEVICE_SCAN_LIMIT = 200;
/** Other accounts on this device recently before a CAPTCHA recheck. */
const SHARED_DEVICE_RECHECK_VOTERS = 2;
/** Other accounts on this device recently before votes are flagged. */
const SHARED_DEVICE_FLAG_VOTERS = 5;
/** Distinct fingerprints a voter may accumulate failure rows for per event. */
const MAX_PASS_ROWS_PER_VOTER = 5;

type LocationStatus =
  | "in_range"
  | "out_of_range"
  | "denied"
  | "unavailable"
  | "inaccurate"
  | "unknown";

type ReviewStatus = "accepted" | "flagged" | "rejected";
type FindingSeverity = "low" | "medium" | "high";
type FindingType =
  | "ip_ua_burst"
  | "fingerprint_reuse"
  | "high_velocity"
  | "team_burst"
  | "location_risk"
  | "pass_metadata_change"
  | "captcha_failures"
  | "identity_cycling"
  | "ip_rotation";

type RiskAssessment = {
  score: number;
  reasons: string[];
  locationStatus?: LocationStatus;
  locationDistanceMeters?: number;
  locationRequiresCaptcha: boolean;
};

type FindingDraft = {
  dedupeKey: string;
  type: FindingType;
  severity: FindingSeverity;
  riskScore: number;
  reasons: string[];
  affectedAppreciationIds: Id<"appreciations">[];
  affectedTeamIds: Id<"teams">[];
  affectedAttendeeIds: string[];
  affectedCount: number;
  summary: string;
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function clampRiskScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addRisk(
  assessment: RiskAssessment,
  score: number,
  reason: string,
): void {
  assessment.score = clampRiskScore(assessment.score + score);
  if (!assessment.reasons.includes(reason)) {
    assessment.reasons.push(reason);
  }
}

function mergeReasons(...groups: Array<string[] | undefined>): string[] {
  return unique(groups.flatMap((group) => group ?? []));
}

function haversineMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coarseMeters(value: number): number {
  return Math.round(value / 25) * 25;
}

function assessLocation(
  event: Doc<"events">,
  location:
    | {
        status: LocationStatus;
        latitude?: number;
        longitude?: number;
        accuracyMeters?: number;
      }
    | undefined,
): RiskAssessment {
  const assessment: RiskAssessment = {
    score: 0,
    reasons: [],
    locationStatus: "unknown",
    locationRequiresCaptcha: false,
  };

  if (!event.venueLocationEnabled) {
    return assessment;
  }

  if (
    typeof event.venueLatitude !== "number" ||
    typeof event.venueLongitude !== "number" ||
    typeof event.venueRadiusMeters !== "number" ||
    event.venueRadiusMeters <= 0
  ) {
    addRisk(assessment, 10, "venue_location_unconfigured");
    assessment.locationStatus = "unknown";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  if (!location) {
    addRisk(assessment, 25, "location_unavailable");
    assessment.locationStatus = "unavailable";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  if (location.status === "denied") {
    addRisk(assessment, 25, "location_denied");
    assessment.locationStatus = "denied";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  if (location.status === "unavailable") {
    addRisk(assessment, 25, "location_unavailable");
    assessment.locationStatus = "unavailable";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    addRisk(assessment, 25, "location_unavailable");
    assessment.locationStatus = "unavailable";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  const distance = haversineMeters(
    event.venueLatitude,
    event.venueLongitude,
    location.latitude,
    location.longitude,
  );
  assessment.locationDistanceMeters = coarseMeters(distance);

  const accuracy = location.accuracyMeters ?? Number.POSITIVE_INFINITY;
  if (accuracy > Math.max(event.venueRadiusMeters, 150)) {
    addRisk(assessment, 20, "location_inaccurate");
    assessment.locationStatus = "inaccurate";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  if (distance > event.venueRadiusMeters) {
    addRisk(assessment, 35, "location_out_of_range");
    assessment.locationStatus = "out_of_range";
    assessment.locationRequiresCaptcha = true;
    return assessment;
  }

  assessment.locationStatus = "in_range";
  return assessment;
}

function assessClientSignals(
  assessment: RiskAssessment,
  clientSignals:
    | {
        webdriver?: boolean;
        isLikelyMobile?: boolean;
        userAgentDataMobile?: boolean;
        viewportWidth?: number;
        viewportHeight?: number;
      }
    | undefined,
): void {
  if (!clientSignals) return;
  if (clientSignals.webdriver) {
    addRisk(assessment, 45, "automation_signal_webdriver");
  }
  if (
    clientSignals.isLikelyMobile === false ||
    clientSignals.userAgentDataMobile === false
  ) {
    addRisk(assessment, 10, "desktop_like_client");
  }
  if (
    typeof clientSignals.viewportWidth === "number" &&
    typeof clientSignals.viewportHeight === "number" &&
    clientSignals.viewportWidth >= 1200 &&
    clientSignals.viewportHeight >= 700
  ) {
    addRisk(assessment, 8, "large_desktop_viewport");
  }
}

function passExpiresAt(event: Doc<"events">, now: number): number {
  return Math.min(now + PASS_TTL_MS, event.endDate + POST_EVENT_SCAN_WINDOW_MS);
}

function getReviewStatus(riskScore: number): ReviewStatus {
  return riskScore >= FLAG_RISK_SCORE ? "flagged" : "accepted";
}

async function recomputeEventAppreciationScores(
  ctx: any,
  eventId: Id<"events">,
) {
  const [teams, appreciations] = await Promise.all([
    ctx.db
      .query("teams")
      .withIndex("by_event", (q: any) => q.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("appreciations")
      .withIndex("by_event", (q: any) => q.eq("eventId", eventId))
      .collect(),
  ]);

  const rawByTeam = new Map<Id<"teams">, number>();
  const cleanByTeam = new Map<Id<"teams">, number>();
  const flaggedByTeam = new Set<Id<"teams">>();

  for (const appreciation of appreciations) {
    rawByTeam.set(
      appreciation.teamId,
      (rawByTeam.get(appreciation.teamId) ?? 0) + 1,
    );
    const status = appreciation.reviewStatus ?? "accepted";
    if (status !== "rejected") {
      cleanByTeam.set(
        appreciation.teamId,
        (cleanByTeam.get(appreciation.teamId) ?? 0) + 1,
      );
    }
    if (status === "flagged") {
      flaggedByTeam.add(appreciation.teamId);
    }
  }

  for (const team of teams) {
    await ctx.db.patch(team._id, {
      rawScore: rawByTeam.get(team._id) ?? 0,
      cleanScore: cleanByTeam.get(team._id) ?? 0,
      flagged: flaggedByTeam.has(team._id),
    });
  }
}

export const evaluateAppreciationRequest = internalMutation({
  args: {
    eventId: v.id("events"),
    attendeeId: v.string(),
    voterUserId: v.id("users"),
    fingerprintKey: v.string(),
    ipAddress: v.string(),
    userAgent: v.string(),
    captchaVerified: v.boolean(),
    location: LOCATION_PAYLOAD_VALIDATOR,
    clientSignals: CLIENT_SIGNALS_VALIDATOR,
  },
  returns: v.object({
    allowed: v.boolean(),
    requiresCaptcha: v.boolean(),
    error: v.optional(v.string()),
    captchaReason: v.optional(v.string()),
    captchaPassId: v.optional(v.id("demoDayCaptchaPasses")),
    reviewStatus: REVIEW_STATUS_VALIDATOR,
    riskScore: v.number(),
    riskReasons: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return {
        allowed: false,
        requiresCaptcha: false,
        error: "Event not found",
        reviewStatus: "accepted" as const,
        riskScore: 0,
        riskReasons: [],
      };
    }
    if (!isDemoDayMode(event.mode)) {
      return {
        allowed: false,
        requiresCaptcha: false,
        error: "Event is not in Demo Day mode",
        reviewStatus: "accepted" as const,
        riskScore: 0,
        riskReasons: [],
      };
    }
    // Hidden events stop accepting votes, even from previously shared links.
    // Checked before any CAPTCHA pass is written.
    if (event.hidden) {
      return {
        allowed: false,
        requiresCaptcha: false,
        error: "Event not found",
        reviewStatus: "accepted" as const,
        riskScore: 0,
        riskReasons: [],
      };
    }
    if (computeEventStatus(event) !== "active") {
      return {
        allowed: false,
        requiresCaptcha: false,
        error: "Appreciations open once the event is live",
        reviewStatus: "accepted" as const,
        riskScore: 0,
        riskReasons: [],
      };
    }

    const assessment = assessLocation(event, args.location);
    assessClientSignals(assessment, args.clientSignals);

    const existingPass = await ctx.db
      .query("demoDayCaptchaPasses")
      .withIndex("by_event_and_voter_fingerprint", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("voterUserId", args.voterUserId)
          .eq("fingerprintKey", args.fingerprintKey),
      )
      .first();

    const passValid = !!existingPass && existingPass.expiresAt > now;
    const passMetadataChanged =
      !!existingPass &&
      passValid &&
      (existingPass.ipAddress !== args.ipAddress ||
        existingPass.userAgent !== args.userAgent);

    if (passMetadataChanged) {
      addRisk(assessment, 40, "pass_metadata_changed");
    }

    const recentAttendeeAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event_and_voter", (q) =>
        q.eq("eventId", args.eventId).eq("voterUserId", args.voterUserId),
      )
      .collect();
    const recentVelocity = recentAttendeeAppreciations.filter(
      (appreciation) => appreciation.timestamp >= now - VELOCITY_WINDOW_MS,
    ).length;
    if (recentVelocity >= VELOCITY_RECHECK_COUNT) {
      addRisk(assessment, 35, "high_velocity");
    }

    // Newest first, bounded: only the burst threshold matters, and a full
    // scan of a shared venue IP could exceed Convex read limits.
    const recentIpPasses = await ctx.db
      .query("demoDayCaptchaPasses")
      .withIndex("by_event_and_ip", (q) =>
        q.eq("eventId", args.eventId).eq("ipAddress", args.ipAddress),
      )
      .order("desc")
      .take(IP_PASS_BURST_COUNT);
    const recentIpPassCount = recentIpPasses.filter(
      (pass) => pass.createdAt >= now - 10 * 60 * 1000,
    ).length;
    if (recentIpPassCount >= IP_PASS_BURST_COUNT) {
      addRisk(assessment, 35, "pass_creation_burst");
    }

    // Quotas are per account, so a second account on the same device gets a
    // fresh budget. Several accounts taking turns on one device forces a new
    // CAPTCHA, and more than a handful flags the vote for review. Phones of
    // the same model can share a fingerprint, so this never refuses a vote.
    const recentDeviceAppreciations = await ctx.db
      .query("appreciations")
      .withIndex("by_event_and_fingerprint_and_timestamp", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("fingerprintKey", args.fingerprintKey)
          .gte("timestamp", now - SHARED_DEVICE_WINDOW_MS),
      )
      .order("desc")
      .take(SHARED_DEVICE_SCAN_LIMIT);
    const otherDeviceVoters = new Set(
      recentDeviceAppreciations
        .map((appreciation) => appreciation.voterUserId)
        .filter((voter) => voter !== undefined && voter !== args.voterUserId),
    ).size;
    if (otherDeviceVoters >= SHARED_DEVICE_RECHECK_VOTERS) {
      addRisk(assessment, RECHECK_RISK_SCORE, "shared_device_accounts");
    }
    if (otherDeviceVoters >= SHARED_DEVICE_FLAG_VOTERS) {
      addRisk(assessment, 40, "many_accounts_one_device");
    }

    const captchaConfigured =
      event.captchaEnabled === true || event.venueLocationEnabled === true;
    const needsCaptcha =
      captchaConfigured &&
      (!passValid ||
        existingPass?.recheckRequired === true ||
        passMetadataChanged ||
        assessment.locationRequiresCaptcha ||
        assessment.score >= RECHECK_RISK_SCORE);

    if (needsCaptcha && !args.captchaVerified) {
      return {
        allowed: false,
        requiresCaptcha: true,
        captchaReason: !passValid
          ? "verification_required"
          : "suspicious_recheck_required",
        reviewStatus: getReviewStatus(assessment.score),
        riskScore: assessment.score,
        riskReasons: assessment.reasons,
      };
    }

    let captchaPassId = existingPass?._id;
    const passRiskReasons = mergeReasons(
      existingPass?.riskReasons,
      assessment.reasons,
    );
    const passRiskScore = Math.max(
      existingPass?.riskScore ?? 0,
      assessment.score,
    );

    if (captchaConfigured && args.captchaVerified) {
      if (existingPass) {
        await ctx.db.patch(existingPass._id, {
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
          verifiedAt: now,
          expiresAt: passExpiresAt(event, now),
          updatedAt: now,
          lastRecheckAt: passValid ? now : existingPass.lastRecheckAt,
          verificationCount: existingPass.verificationCount + 1,
          recheckRequired: false,
          riskScore: passRiskScore,
          riskReasons: passRiskReasons,
          locationStatus: assessment.locationStatus,
          locationDistanceMeters: assessment.locationDistanceMeters,
        });
      } else {
        captchaPassId = await ctx.db.insert("demoDayCaptchaPasses", {
          eventId: args.eventId,
          attendeeId: args.attendeeId,
          voterUserId: args.voterUserId,
          fingerprintKey: args.fingerprintKey,
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
          verifiedAt: now,
          expiresAt: passExpiresAt(event, now),
          lastUsedAt: now,
          createdAt: now,
          updatedAt: now,
          verificationCount: 1,
          recheckRequired: false,
          riskScore: assessment.score,
          riskReasons: assessment.reasons,
          locationStatus: assessment.locationStatus,
          locationDistanceMeters: assessment.locationDistanceMeters,
        });
      }
    } else if (existingPass) {
      await ctx.db.patch(existingPass._id, {
        lastUsedAt: now,
        updatedAt: now,
        riskScore: passRiskScore,
        riskReasons: passRiskReasons,
        locationStatus: assessment.locationStatus,
        locationDistanceMeters: assessment.locationDistanceMeters,
      });
    }

    return {
      allowed: true,
      requiresCaptcha: false,
      captchaPassId,
      reviewStatus: getReviewStatus(assessment.score),
      riskScore: assessment.score,
      riskReasons: assessment.reasons,
    };
  },
});

export const recordCaptchaFailure = internalMutation({
  args: {
    eventId: v.id("events"),
    attendeeId: v.string(),
    voterUserId: v.id("users"),
    fingerprintKey: v.string(),
    ipAddress: v.string(),
    userAgent: v.string(),
    failureReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const pass = await ctx.db
      .query("demoDayCaptchaPasses")
      .withIndex("by_event_and_voter_fingerprint", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("voterUserId", args.voterUserId)
          .eq("fingerprintKey", args.fingerprintKey),
      )
      .first();
    const failureReason = `captcha_failure:${args.failureReason}`;
    if (!pass) {
      // Each new fingerprint would otherwise add a row. Past the cap, record
      // the failure on an existing row so junk tokens cannot grow the table.
      const voterPasses = await ctx.db
        .query("demoDayCaptchaPasses")
        .withIndex("by_event_and_voter_fingerprint", (q) =>
          q.eq("eventId", args.eventId).eq("voterUserId", args.voterUserId),
        )
        .take(MAX_PASS_ROWS_PER_VOTER);
      if (voterPasses.length >= MAX_PASS_ROWS_PER_VOTER) {
        const target = voterPasses[0];
        await ctx.db.patch(target._id, {
          updatedAt: now,
          lastFailureAt: now,
          failureCount: (target.failureCount ?? 0) + 1,
          recheckRequired: true,
          riskScore: clampRiskScore((target.riskScore ?? 0) + 20),
          riskReasons: mergeReasons(target.riskReasons, [
            failureReason,
            "fingerprint_churn",
          ]),
        });
        return null;
      }
      await ctx.db.insert("demoDayCaptchaPasses", {
        eventId: args.eventId,
        attendeeId: args.attendeeId,
        voterUserId: args.voterUserId,
        fingerprintKey: args.fingerprintKey,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        expiresAt: now - 1,
        createdAt: now,
        updatedAt: now,
        verificationCount: 0,
        recheckRequired: true,
        riskScore: 20,
        riskReasons: [failureReason],
        lastFailureAt: now,
        failureCount: 1,
      });
      return null;
    }
    const metadataChanged =
      pass.ipAddress !== args.ipAddress || pass.userAgent !== args.userAgent;
    await ctx.db.patch(pass._id, {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      updatedAt: now,
      lastFailureAt: now,
      failureCount: (pass.failureCount ?? 0) + 1,
      recheckRequired: true,
      riskScore: clampRiskScore(
        (pass.riskScore ?? 0) + 20 + (metadataChanged ? 40 : 0),
      ),
      riskReasons: mergeReasons(pass.riskReasons, [
        failureReason,
        ...(metadataChanged ? ["pass_metadata_changed"] : []),
      ]),
    });
    return null;
  },
});

function makeFinding(
  type: FindingType,
  key: string,
  severity: FindingSeverity,
  riskScore: number,
  reasons: string[],
  appreciations: Doc<"appreciations">[],
  summary: string,
): FindingDraft {
  return {
    dedupeKey: `${type}:${key}`,
    type,
    severity,
    riskScore,
    reasons,
    affectedAppreciationIds: unique(appreciations.map((a) => a._id)),
    affectedTeamIds: unique(appreciations.map((a) => a.teamId)),
    affectedAttendeeIds: unique(appreciations.map((a) => a.attendeeId)),
    affectedCount: appreciations.length,
    summary,
  };
}

function getSeverity(score: number): FindingSeverity {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

/** Signed-in voter when present, else the legacy client attendee ID. */
function voterKey(appreciation: Doc<"appreciations">): string {
  return appreciation.voterUserId ?? `legacy:${appreciation.attendeeId}`;
}

function groupRows(
  rows: Doc<"appreciations">[],
  keyFn: (appreciation: Doc<"appreciations">) => string,
): Map<string, Doc<"appreciations">[]> {
  const groups = new Map<string, Doc<"appreciations">[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Busiest `windowMs` stretch of `rows` by row count. Windows are anchored on
 * the rows' own timestamps rather than the scan time, so a scan run after the
 * event ends finds the same bursts a live scan would have.
 */
function densestWindow(
  rows: Doc<"appreciations">[],
  windowMs: number,
): Doc<"appreciations">[] {
  const ordered = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  let bestStart = 0;
  let bestEnd = 0;
  let start = 0;
  for (let end = 0; end < ordered.length; end += 1) {
    while (ordered[end].timestamp - ordered[start].timestamp > windowMs) {
      start += 1;
    }
    if (end + 1 - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = end + 1;
    }
  }
  return ordered.slice(bestStart, bestEnd);
}

/** A new voter identity on the same device within this gap continues a chain. */
const IDENTITY_CYCLE_GAP_MS = 3 * 60 * 1000;
/** Identities in one chain (the first plus follow-ups) before it is reported. */
const IDENTITY_CYCLE_MIN_IDENTITIES = 3;
const IP_ROTATION_WINDOW_MS = 10 * 60 * 1000;
const IP_ROTATION_MIN_IPS = 4;

/**
 * Same device, same project, a fresh voter identity starting shortly after
 * the previous one stopped. This is the clear-storage-and-revote loop that
 * inflated Spring 2026. Only follow-up identities are affected; the first
 * identity in each chain is treated as the device's genuine voter.
 */
function buildIdentityCycleDrafts(
  rows: Doc<"appreciations">[],
): FindingDraft[] {
  const drafts: FindingDraft[] = [];
  for (const [key, deviceTeamRows] of groupRows(
    rows,
    (a) => `${a.fingerprintKey}|${a.teamId}`,
  )) {
    const sessions = Array.from(groupRows(deviceTeamRows, voterKey).values())
      .map((sessionRows) => {
        const timestamps = sessionRows.map((row) => row.timestamp);
        return {
          rows: sessionRows,
          start: Math.min(...timestamps),
          end: Math.max(...timestamps),
        };
      })
      .sort((a, b) => a.start - b.start);
    if (sessions.length < IDENTITY_CYCLE_MIN_IDENTITIES) continue;

    const chains: Array<typeof sessions> = [];
    let chainEnd = -Infinity;
    for (const session of sessions) {
      if (chains.length > 0 && session.start - chainEnd <= IDENTITY_CYCLE_GAP_MS) {
        chains[chains.length - 1].push(session);
      } else {
        chains.push([session]);
      }
      chainEnd = Math.max(chainEnd, session.end);
    }
    const cycles = chains.filter(
      (chain) => chain.length >= IDENTITY_CYCLE_MIN_IDENTITIES,
    );
    if (cycles.length === 0) continue;
    const followUps = cycles.flatMap((chain) =>
      chain.slice(1).flatMap((session) => session.rows),
    );
    const longestChain = Math.max(...cycles.map((chain) => chain.length));

    const score = longestChain >= 5 ? 92 : 80;
    drafts.push(
      makeFinding(
        "identity_cycling",
        key,
        getSeverity(score),
        score,
        ["same_device_new_identity_same_project"],
        followUps,
        `${longestChain} voter identities on one device took turns voting for the same project, each starting within ${IDENTITY_CYCLE_GAP_MS / 60000} minutes of the last.`,
      ),
    );
  }
  return drafts;
}

export function buildFindingDrafts(appreciations: Doc<"appreciations">[]) {
  const drafts: FindingDraft[] = [];
  const activeAppreciations = appreciations.filter(
    (appreciation) => (appreciation.reviewStatus ?? "accepted") !== "rejected",
  );
  const groupBy = (keyFn: (appreciation: Doc<"appreciations">) => string) =>
    groupRows(activeAppreciations, keyFn);

  for (const [key, rows] of groupBy((a) => `${a.ipAddress}|${a.userAgent}`)) {
    const burstRows = densestWindow(rows, 10 * 60 * 1000);
    const distinctVoters = unique(burstRows.map(voterKey));
    if (burstRows.length >= 20 && distinctVoters.length >= 8) {
      const score = distinctVoters.length >= 15 ? 90 : 75;
      drafts.push(
        makeFinding(
          "ip_ua_burst",
          key,
          getSeverity(score),
          score,
          ["many_attendees_same_ip_user_agent"],
          burstRows,
          `${burstRows.length} appreciations from ${distinctVoters.length} voters on one IP/user-agent cluster within 10 minutes.`,
        ),
      );
    }
  }

  for (const [fingerprint, rows] of groupBy((a) => a.fingerprintKey)) {
    const distinctVoters = unique(rows.map(voterKey));
    if (distinctVoters.length >= 4 && rows.length >= 12) {
      const score = distinctVoters.length >= 8 ? 90 : 70;
      drafts.push(
        makeFinding(
          "fingerprint_reuse",
          fingerprint,
          getSeverity(score),
          score,
          ["same_fingerprint_many_attendees"],
          rows,
          `${distinctVoters.length} voters share one browser fingerprint.`,
        ),
      );
    }
  }

  for (const [voter, rows] of groupBy(voterKey)) {
    const windowRows = densestWindow(rows, VELOCITY_WINDOW_MS);
    if (windowRows.length >= VELOCITY_RECHECK_COUNT) {
      drafts.push(
        makeFinding(
          "high_velocity",
          voter,
          "medium",
          70,
          ["high_appreciation_velocity"],
          windowRows,
          `${windowRows.length} appreciations from one voter within 60 seconds.`,
        ),
      );
    }
  }

  for (const [key, rows] of groupBy(
    (a) => `${a.teamId}|${a.ipAddress}|${a.userAgent}`,
  )) {
    const burstRows = densestWindow(rows, 2 * 60 * 1000);
    const distinctVoters = unique(burstRows.map(voterKey));
    if (burstRows.length >= 8 && distinctVoters.length >= 5) {
      drafts.push(
        makeFinding(
          "team_burst",
          key,
          "medium",
          72,
          ["team_specific_burst"],
          burstRows,
          `${burstRows.length} appreciations hit one project from a single IP/user-agent cluster within 2 minutes.`,
        ),
      );
    }
  }

  drafts.push(...buildIdentityCycleDrafts(activeAppreciations));

  // One device voting for one project from many networks in a short span is
  // VPN or proxy hopping; a phone moving from wifi to cellular adds one or two.
  for (const [key, rows] of groupBy((a) => `${a.fingerprintKey}|${a.teamId}`)) {
    const ordered = [...rows].sort((a, b) => a.timestamp - b.timestamp);
    const ipCounts = new Map<string, number>();
    let start = 0;
    let bestStart = 0;
    let bestEnd = 0;
    let bestIps = 0;
    for (let end = 0; end < ordered.length; end += 1) {
      ipCounts.set(
        ordered[end].ipAddress,
        (ipCounts.get(ordered[end].ipAddress) ?? 0) + 1,
      );
      while (
        ordered[end].timestamp - ordered[start].timestamp >
        IP_ROTATION_WINDOW_MS
      ) {
        const ip = ordered[start].ipAddress;
        const remaining = (ipCounts.get(ip) ?? 1) - 1;
        if (remaining === 0) ipCounts.delete(ip);
        else ipCounts.set(ip, remaining);
        start += 1;
      }
      if (ipCounts.size > bestIps) {
        bestIps = ipCounts.size;
        bestStart = start;
        bestEnd = end + 1;
      }
    }
    const best = ordered.slice(bestStart, bestEnd);
    if (bestIps >= IP_ROTATION_MIN_IPS) {
      const score = bestIps >= 8 ? 90 : 75;
      drafts.push(
        makeFinding(
          "ip_rotation",
          key,
          getSeverity(score),
          score,
          ["same_device_many_networks_same_project"],
          best,
          `One device voted for the same project from ${bestIps} networks within ${IP_ROTATION_WINDOW_MS / 60000} minutes.`,
        ),
      );
    }
  }

  const locationRiskRows = activeAppreciations.filter((a) =>
    (a.riskReasons ?? []).some((reason) => reason.startsWith("location_")),
  );
  for (const [key, rows] of groupBy((a) => `${a.ipAddress}|location`)) {
    const riskyRows = rows.filter((row) => locationRiskRows.includes(row));
    if (riskyRows.length >= 5) {
      drafts.push(
        makeFinding(
          "location_risk",
          key,
          "low",
          55,
          ["repeated_location_risk"],
          riskyRows,
          `${riskyRows.length} appreciations have denied, unavailable, inaccurate, or out-of-range location signals.`,
        ),
      );
    }
  }

  const metadataRows = activeAppreciations.filter((a) =>
    (a.riskReasons ?? []).includes("pass_metadata_changed"),
  );
  if (metadataRows.length >= 3) {
    drafts.push(
      makeFinding(
        "pass_metadata_change",
        "event",
        "medium",
        65,
        ["pass_metadata_changed"],
        metadataRows,
        `${metadataRows.length} appreciations came from passes whose IP or user-agent changed.`,
      ),
    );
  }

  return drafts;
}

function buildCaptchaFailureDrafts(
  passes: Doc<"demoDayCaptchaPasses">[],
  now: number,
): FindingDraft[] {
  return passes
    .filter(
      (pass) =>
        (pass.failureCount ?? 0) >= 3 &&
        typeof pass.lastFailureAt === "number" &&
        pass.lastFailureAt >= now - 10 * 60 * 1000,
    )
    .map((pass) => ({
      dedupeKey: `captcha_failures:${pass.ipAddress}|${pass.fingerprintKey}`,
      type: "captcha_failures" as const,
      severity: "medium" as const,
      riskScore: 70,
      reasons: ["repeated_captcha_failures"],
      affectedAppreciationIds: [],
      affectedTeamIds: [],
      affectedAttendeeIds: [pass.attendeeId],
      affectedCount: 0,
      summary: `${pass.failureCount ?? 0} captcha failures for one attendee/fingerprint pass.`,
    }));
}

async function upsertFinding(
  ctx: any,
  eventId: Id<"events">,
  draft: FindingDraft,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("demoDayIntegrityFindings")
    .withIndex("by_event_and_dedupe_key", (q: any) =>
      q.eq("eventId", eventId).eq("dedupeKey", draft.dedupeKey),
    )
    .first();

  let findingId: Id<"demoDayIntegrityFindings">;
  if (existing) {
    findingId = existing._id;
    await ctx.db.patch(existing._id, {
      severity: draft.severity,
      riskScore: Math.max(existing.riskScore, draft.riskScore),
      reasons: mergeReasons(existing.reasons, draft.reasons),
      affectedAppreciationIds: unique([
        ...existing.affectedAppreciationIds,
        ...draft.affectedAppreciationIds,
      ]),
      affectedTeamIds: unique([
        ...existing.affectedTeamIds,
        ...draft.affectedTeamIds,
      ]),
      affectedAttendeeIds: unique([
        ...existing.affectedAttendeeIds,
        ...draft.affectedAttendeeIds,
      ]),
      affectedCount: Math.max(existing.affectedCount, draft.affectedCount),
      summary: draft.summary,
      lastSeenAt: now,
    });
  } else {
    findingId = await ctx.db.insert("demoDayIntegrityFindings", {
      eventId,
      dedupeKey: draft.dedupeKey,
      type: draft.type,
      severity: draft.severity,
      status: "open",
      riskScore: draft.riskScore,
      reasons: draft.reasons,
      affectedAppreciationIds: draft.affectedAppreciationIds,
      affectedTeamIds: draft.affectedTeamIds,
      affectedAttendeeIds: draft.affectedAttendeeIds,
      affectedCount: draft.affectedCount,
      summary: draft.summary,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  for (const appreciationId of draft.affectedAppreciationIds) {
    const appreciation = await ctx.db.get(appreciationId);
    if (!appreciation || appreciation.reviewStatus === "rejected") continue;
    // An organizer's decision outlasts later scans, and the cron re-finds the
    // same rows every run, so skip rows this finding already covers.
    if (appreciation.reviewedAt !== undefined) continue;
    if (
      appreciation.reviewStatus === "flagged" &&
      appreciation.integrityFindingId === findingId &&
      draft.reasons.every((reason) =>
        (appreciation.riskReasons ?? []).includes(reason),
      )
    ) {
      continue;
    }
    await ctx.db.patch(appreciationId, {
      reviewStatus: "flagged",
      integrityFindingId: findingId,
      riskScore: Math.max(appreciation.riskScore ?? 0, draft.riskScore),
      riskReasons: mergeReasons(appreciation.riskReasons, draft.reasons),
    });
  }

  return findingId;
}

async function scanEvent(ctx: any, eventId: Id<"events">) {
  const now = Date.now();
  const event = await ctx.db.get(eventId);
  if (!event || !isDemoDayMode(event.mode)) {
    throw new Error("Event is not in Demo Day mode");
  }

  const appreciations = await ctx.db
    .query("appreciations")
    .withIndex("by_event", (q: any) => q.eq("eventId", eventId))
    .collect();
  const passes = await ctx.db
    .query("demoDayCaptchaPasses")
    .withIndex("by_event_and_ip", (q: any) => q.eq("eventId", eventId))
    .collect();
  const drafts = [
    ...buildFindingDrafts(appreciations),
    ...buildCaptchaFailureDrafts(passes, now),
  ];

  for (const draft of drafts) {
    await upsertFinding(ctx, eventId, draft);
  }

  await recomputeEventAppreciationScores(ctx, eventId);

  return {
    scannedCount: appreciations.length,
    findingCount: drafts.length,
  };
}

export const scanActiveDemoDayEvents = internalMutation({
  args: {},
  returns: v.object({
    eventsScanned: v.number(),
    findingsCreatedOrUpdated: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db.query("events").collect();
    let eventsScanned = 0;
    let findingsCreatedOrUpdated = 0;

    for (const event of events) {
      if (!isDemoDayMode(event.mode)) continue;
      const status = computeEventStatus(event);
      const recentlyEnded = event.endDate >= now - POST_EVENT_SCAN_WINDOW_MS;
      if (status !== "active" && !recentlyEnded) continue;

      const result = await scanEvent(ctx, event._id);
      eventsScanned += 1;
      findingsCreatedOrUpdated += result.findingCount;
    }

    return { eventsScanned, findingsCreatedOrUpdated };
  },
});

export const runIntegrityScan = mutation({
  args: { eventId: v.id("events") },
  returns: v.object({
    scannedCount: v.number(),
    findingCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await scanEvent(ctx, args.eventId);
  },
});

export const getEventIntegritySummary = query({
  args: { eventId: v.id("events") },
  returns: v.object({
    openFindings: v.number(),
    flaggedAppreciations: v.number(),
    rejectedAppreciations: v.number(),
    findings: v.array(
      v.object({
        _id: v.id("demoDayIntegrityFindings"),
        type: v.string(),
        severity: v.string(),
        status: v.string(),
        riskScore: v.number(),
        reasons: v.array(v.string()),
        affectedCount: v.number(),
        affectedTeamIds: v.array(v.id("teams")),
        affectedAttendeeIds: v.array(v.string()),
        affectedTeams: v.array(
          v.object({
            teamId: v.id("teams"),
            teamName: v.string(),
            appreciationIds: v.array(v.id("appreciations")),
            affectedVotes: v.number(),
            projectedCleanScoreImpact: v.number(),
          }),
        ),
        summary: v.string(),
        firstSeenAt: v.number(),
        lastSeenAt: v.number(),
        reviewNote: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const [findings, flagged, rejected, teams] = await Promise.all([
      ctx.db
        .query("demoDayIntegrityFindings")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("appreciations")
        .withIndex("by_event_and_review_status", (q) =>
          q.eq("eventId", args.eventId).eq("reviewStatus", "flagged"),
        )
        .collect(),
      ctx.db
        .query("appreciations")
        .withIndex("by_event_and_review_status", (q) =>
          q.eq("eventId", args.eventId).eq("reviewStatus", "rejected"),
        )
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);
    const teamNames = new Map(teams.map((team) => [team._id, team.name]));
    const affectedAppreciationIds = unique(
      findings.flatMap((finding) => finding.affectedAppreciationIds),
    );
    const affectedAppreciations = (
      await Promise.all(
        affectedAppreciationIds.map((appreciationId) =>
          ctx.db.get(appreciationId),
        ),
      )
    ).filter((appreciation): appreciation is Doc<"appreciations"> =>
      Boolean(appreciation),
    );
    const appreciationsById = new Map(
      affectedAppreciations.map((appreciation) => [
        appreciation._id,
        appreciation,
      ]),
    );

    const sortedFindings = findings.sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return b.lastSeenAt - a.lastSeenAt;
    });

    return {
      openFindings: findings.filter((finding) => finding.status === "open")
        .length,
      flaggedAppreciations: flagged.length,
      rejectedAppreciations: rejected.length,
      findings: sortedFindings.map((finding) => ({
        _id: finding._id,
        type: finding.type,
        severity: finding.severity,
        status: finding.status,
        riskScore: finding.riskScore,
        reasons: finding.reasons,
        affectedCount: finding.affectedCount,
        affectedTeamIds: finding.affectedTeamIds,
        affectedAttendeeIds: finding.affectedAttendeeIds,
        affectedTeams: finding.affectedTeamIds.map((teamId) => {
          const teamAppreciations = finding.affectedAppreciationIds
            .map((appreciationId) => appreciationsById.get(appreciationId))
            .filter(
              (appreciation): appreciation is Doc<"appreciations"> =>
                !!appreciation && appreciation.teamId === teamId,
            );
          return {
            teamId,
            teamName: teamNames.get(teamId) ?? "Unknown project",
            appreciationIds: teamAppreciations.map(
              (appreciation) => appreciation._id,
            ),
            affectedVotes: teamAppreciations.length,
            projectedCleanScoreImpact: teamAppreciations.filter(
              (appreciation) =>
                (appreciation.reviewStatus ?? "accepted") !== "rejected",
            ).length,
          };
        }),
        summary: finding.summary,
        firstSeenAt: finding.firstSeenAt,
        lastSeenAt: finding.lastSeenAt,
        reviewNote: finding.reviewNote,
      })),
    };
  },
});

async function setFindingStatus(
  ctx: any,
  findingId: Id<"demoDayIntegrityFindings">,
  status: "reviewed" | "rejected",
  note: string | undefined,
) {
  const adminId = await requireAdmin(ctx);
  const finding = await ctx.db.get(findingId);
  if (!finding) throw new Error("Finding not found");
  const now = Date.now();

  for (const appreciationId of finding.affectedAppreciationIds) {
    const appreciation = await ctx.db.get(appreciationId);
    if (!appreciation) continue;
    if (status === "rejected") {
      await ctx.db.patch(appreciationId, {
        reviewStatus: "rejected",
        reviewedAt: now,
        reviewedBy: adminId,
        reviewNote: note,
      });
    } else if (appreciation.reviewStatus === "flagged") {
      await ctx.db.patch(appreciationId, {
        reviewedAt: now,
        reviewedBy: adminId,
        reviewNote: note,
      });
    }
  }

  await ctx.db.patch(findingId, {
    status,
    reviewedAt: now,
    reviewedBy: adminId,
    reviewNote: note,
  });
  await recomputeEventAppreciationScores(ctx, finding.eventId);
}

export const markFindingReviewed = mutation({
  args: {
    findingId: v.id("demoDayIntegrityFindings"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setFindingStatus(ctx, args.findingId, "reviewed", args.note);
    return null;
  },
});

export const rejectFinding = mutation({
  args: {
    findingId: v.id("demoDayIntegrityFindings"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setFindingStatus(ctx, args.findingId, "rejected", args.note);
    return null;
  },
});

export const restoreFinding = mutation({
  args: {
    findingId: v.id("demoDayIntegrityFindings"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new Error("Finding not found");
    const now = Date.now();

    for (const appreciationId of finding.affectedAppreciationIds) {
      const appreciation = await ctx.db.get(appreciationId);
      if (!appreciation) continue;
      await ctx.db.patch(appreciationId, {
        reviewStatus: "flagged",
        reviewedAt: now,
        reviewedBy: adminId,
        reviewNote: args.note,
      });
    }

    await ctx.db.patch(args.findingId, {
      status: "reviewed",
      reviewedAt: now,
      reviewedBy: adminId,
      reviewNote: args.note,
    });
    await recomputeEventAppreciationScores(ctx, finding.eventId);
    return null;
  },
});

export const reviewAppreciations = mutation({
  args: {
    appreciationIds: v.array(v.id("appreciations")),
    reviewStatus: REVIEW_STATUS_VALIDATOR,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();
    const eventIds = new Set<Id<"events">>();

    for (const appreciationId of args.appreciationIds) {
      const appreciation = await ctx.db.get(appreciationId);
      if (!appreciation) continue;
      eventIds.add(appreciation.eventId);
      await ctx.db.patch(appreciationId, {
        reviewStatus: args.reviewStatus,
        reviewedAt: now,
        reviewedBy: adminId,
        reviewNote: args.note,
      });
    }

    for (const eventId of eventIds) {
      await recomputeEventAppreciationScores(ctx, eventId);
    }
    return null;
  },
});
