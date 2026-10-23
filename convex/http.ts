import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const http = httpRouter();
export const DEMO_DAY_TURNSTILE_ACTION = "demo_day_appreciation";

auth.addHttpRoutes(http);

/**
 * Extract client IP address from request headers.
 * Handles various proxy headers in order of preference.
 */
function getClientIp(req: Request): string {
  // Try Cloudflare header first
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Try X-Forwarded-For (may contain multiple IPs, take first)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  // Try X-Real-IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Fallback
  return "unknown";
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigins = [
    process.env.SITE_URL,
    process.env.CONVEX_SITE_URL,
  ].filter((value): value is string => !!value);
  const isLocalhost =
    !!origin &&
    (/^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
  const isAllowed =
    !!origin && (allowedOrigins.includes(origin) || isLocalhost);

  return {
    "Content-Type": "application/json",
    ...(isAllowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function getExpectedTurnstileHostname(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const configured = env.TURNSTILE_EXPECTED_HOSTNAME || env.SITE_URL;
  if (!configured) return undefined;
  try {
    return new URL(configured.includes("://") ? configured : `https://${configured}`).hostname;
  } catch {
    return undefined;
  }
}

export function validateTurnstileResponse(
  result: {
    success?: boolean;
    action?: string;
    hostname?: string;
  },
  expectedHostname?: string,
): { success: boolean; error?: string } {
  if (result.success !== true || result.action !== DEMO_DAY_TURNSTILE_ACTION) {
    return { success: false, error: "Captcha verification failed" };
  }
  if (expectedHostname && result.hostname !== expectedHostname) {
    return { success: false, error: "Captcha verification failed" };
  }
  return { success: true };
}

async function verifyTurnstileToken({
  token,
  ipAddress,
}: {
  token: string;
  ipAddress: string;
}): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, error: "Captcha is not configured" };
  }

  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", token);
  formData.set("action", DEMO_DAY_TURNSTILE_ACTION);
  if (ipAddress !== "unknown") {
    formData.set("remoteip", ipAddress);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    },
  );
  if (!response.ok) {
    return { success: false, error: "Captcha verification failed" };
  }

  const result = (await response.json()) as {
    success?: boolean;
    action?: string;
    hostname?: string;
  };
  return validateTurnstileResponse(
    result,
    getExpectedTurnstileHostname(),
  );
}

const MAX_ID_LENGTH = 64;
const MAX_CLIENT_KEY_LENGTH = 128;
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_SIGNAL_TEXT_LENGTH = 64;
const LOCATION_STATUSES = [
  "in_range",
  "out_of_range",
  "denied",
  "unavailable",
  "inaccurate",
  "unknown",
] as const;

type LocationPayload = {
  status: (typeof LOCATION_STATUSES)[number];
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

type ClientSignalsPayload = {
  webdriver?: boolean;
  isLikelyMobile?: boolean;
  userAgentDataMobile?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  language?: string;
  timezone?: string;
};

export type AppreciationRequestBody = {
  eventId: string;
  teamId: string;
  attendeeId: string;
  fingerprintKey: string;
  turnstileToken?: string;
  location?: LocationPayload;
  clientSignals?: ClientSignalsPayload;
};

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function finiteInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Location coordinates come from the browser and cannot prove attendance.
 * Out-of-range values are dropped so the server treats them as unavailable.
 */
function parseLocation(value: unknown): LocationPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const status = LOCATION_STATUSES.find((candidate) => candidate === raw.status);
  if (!status) return undefined;
  const latitude = finiteInRange(raw.latitude, -90, 90);
  const longitude = finiteInRange(raw.longitude, -180, 180);
  const accuracyMeters = finiteInRange(raw.accuracyMeters, 0, 1_000_000);
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  return {
    status,
    ...(hasCoordinates ? { latitude, longitude } : {}),
    ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
  };
}

function parseClientSignals(value: unknown): ClientSignalsPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const signals: ClientSignalsPayload = {
    webdriver: optionalBoolean(raw.webdriver),
    isLikelyMobile: optionalBoolean(raw.isLikelyMobile),
    userAgentDataMobile: optionalBoolean(raw.userAgentDataMobile),
    viewportWidth: finiteInRange(raw.viewportWidth, 0, 100_000),
    viewportHeight: finiteInRange(raw.viewportHeight, 0, 100_000),
    language: boundedString(raw.language, MAX_SIGNAL_TEXT_LENGTH),
    timezone: boundedString(raw.timezone, MAX_SIGNAL_TEXT_LENGTH),
  };
  // Convex values cannot hold `undefined`, so drop unset fields.
  return Object.fromEntries(
    Object.entries(signals).filter(([, entry]) => entry !== undefined),
  ) as ClientSignalsPayload;
}

/** Validates the untrusted request body, capping every client-supplied string. */
export function parseAppreciationRequestBody(
  body: unknown,
): AppreciationRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const eventId = boundedString(raw.eventId, MAX_ID_LENGTH);
  const teamId = boundedString(raw.teamId, MAX_ID_LENGTH);
  const attendeeId = boundedString(raw.attendeeId, MAX_CLIENT_KEY_LENGTH);
  const fingerprintKey = boundedString(raw.fingerprintKey, MAX_CLIENT_KEY_LENGTH);
  if (!eventId || !teamId || !attendeeId || !fingerprintKey) return null;
  if (
    raw.turnstileToken !== undefined &&
    raw.turnstileToken !== null &&
    !boundedString(raw.turnstileToken, MAX_TURNSTILE_TOKEN_LENGTH)
  ) {
    return null;
  }
  const turnstileToken = boundedString(raw.turnstileToken, MAX_TURNSTILE_TOKEN_LENGTH);
  const location = parseLocation(raw.location);
  const clientSignals = parseClientSignals(raw.clientSignals);
  return {
    eventId,
    teamId,
    attendeeId,
    fingerprintKey,
    ...(turnstileToken ? { turnstileToken } : {}),
    ...(location ? { location } : {}),
    ...(clientSignals ? { clientSignals } : {}),
  };
}

/**
 * POST /demo-day/appreciations
 * Create a new appreciation for a team in Demo Day mode.
 *
 * Request body:
 * {
 *   eventId: string,
 *   teamId: string,
 *   attendeeId: string,
 *   fingerprintKey: string
 * }
 */
http.route({
  path: "/demo-day/appreciations",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Parse request body
      const headers = getCorsHeaders(req);
      const voterUserId = await getAuthUserId(ctx);
      if (!voterUserId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Sign in is required to vote",
            remainingForTeam: 0,
            remainingTotal: 0,
          }),
          { status: 401, headers },
        );
      }
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        body = null;
      }
      const parsed = parseAppreciationRequestBody(body);
      if (!parsed) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Invalid request: eventId, teamId, attendeeId and fingerprintKey are required",
          }),
          {
            status: 400,
            headers,
          },
        );
      }
      const {
        eventId,
        teamId,
        attendeeId,
        fingerprintKey,
        turnstileToken,
        location,
        clientSignals,
      } = parsed;

      // Extract IP and User-Agent from request
      const ipAddress = getClientIp(req).slice(0, MAX_CLIENT_KEY_LENGTH);
      const userAgent = (req.headers.get("user-agent") || "unknown").slice(
        0,
        MAX_USER_AGENT_LENGTH,
      );

      let integrity = await ctx.runMutation(
        internal.demoDayIntegrity.evaluateAppreciationRequest,
        {
          eventId: eventId as Id<"events">,
          attendeeId,
          voterUserId,
          fingerprintKey,
          ipAddress,
          userAgent,
          captchaVerified: false,
          location,
          clientSignals,
        },
      );

      if (integrity.requiresCaptcha) {
        if (!turnstileToken) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Verification required. Please try again.",
              requiresCaptcha: true,
              remainingForTeam: 0,
              remainingTotal: 0,
            }),
            {
              status: 403,
              headers,
            },
          );
        }

        const captchaResult = await verifyTurnstileToken({
          token: turnstileToken,
          ipAddress,
        });
        if (!captchaResult.success) {
          await ctx.runMutation(
            internal.demoDayIntegrity.recordCaptchaFailure,
            {
              eventId: eventId as Id<"events">,
              attendeeId,
              voterUserId,
              fingerprintKey,
              ipAddress,
              userAgent,
              failureReason: captchaResult.error || "verification_failed",
            },
          );
          return new Response(
            JSON.stringify({
              success: false,
              error: "Verification failed",
              requiresCaptcha: true,
              remainingForTeam: 0,
              remainingTotal: 0,
            }),
            {
              status: 403,
              headers,
            },
          );
        }

        integrity = await ctx.runMutation(
          internal.demoDayIntegrity.evaluateAppreciationRequest,
          {
            eventId: eventId as Id<"events">,
            attendeeId,
            voterUserId,
            fingerprintKey,
            ipAddress,
            userAgent,
            captchaVerified: true,
            location,
            clientSignals,
          },
        );
      }

      if (!integrity.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: integrity.error || "Unable to verify request",
            requiresCaptcha: integrity.requiresCaptcha,
            remainingForTeam: 0,
            remainingTotal: 0,
          }),
          {
            status: integrity.requiresCaptcha ? 403 : 400,
            headers,
          },
        );
      }

      // Call the internal mutation with trusted metadata
      const result = await ctx.runMutation(
        internal.appreciations.createAppreciationInternal,
        {
          eventId: eventId as Id<"events">,
          teamId: teamId as Id<"teams">,
          attendeeId,
          voterUserId,
          fingerprintKey,
          ipAddress,
          userAgent,
          captchaPassId: integrity.captchaPassId,
          reviewStatus: integrity.reviewStatus,
          riskScore: integrity.riskScore,
          riskReasons: integrity.riskReasons,
        },
      );

      return new Response(
        // Risk scores and reasons stay server-side so callers cannot learn
        // which signals to change.
        JSON.stringify(result),
        {
          status: result.success ? 200 : 400,
          headers,
        },
      );
    } catch (error) {
      console.error("Error creating appreciation:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Internal server error",
        }),
        {
          status: 500,
          headers: getCorsHeaders(req),
        },
      );
    }
  }),
});

/**
 * OPTIONS /demo-day/appreciations
 * Handle CORS preflight requests.
 */
http.route({
  path: "/demo-day/appreciations",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(req),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
