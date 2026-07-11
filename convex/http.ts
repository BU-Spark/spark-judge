import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
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
      const body = await req.json();
      const {
        eventId,
        teamId,
        attendeeId,
        fingerprintKey,
        turnstileToken,
        location,
        clientSignals,
      } = body as {
        eventId: string;
        teamId: string;
        attendeeId: string;
        fingerprintKey: string;
        turnstileToken?: string;
        location?: {
          status:
            | "in_range"
            | "out_of_range"
            | "denied"
            | "unavailable"
            | "inaccurate"
            | "unknown";
          latitude?: number;
          longitude?: number;
          accuracyMeters?: number;
        };
        clientSignals?: {
          webdriver?: boolean;
          isLikelyMobile?: boolean;
          userAgentDataMobile?: boolean;
          viewportWidth?: number;
          viewportHeight?: number;
          language?: string;
          timezone?: string;
        };
      };

      // Validate required fields
      if (!eventId || !teamId || !attendeeId || !fingerprintKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Missing required fields: eventId, teamId, attendeeId, fingerprintKey",
          }),
          {
            status: 400,
            headers,
          },
        );
      }

      // Extract IP and User-Agent from request
      const ipAddress = getClientIp(req);
      const userAgent = req.headers.get("user-agent") || "unknown";

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
              captchaReason: integrity.captchaReason,
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
        JSON.stringify({
          ...result,
          integrity: {
            reviewStatus: integrity.reviewStatus,
            riskScore: integrity.riskScore,
            riskReasons: integrity.riskReasons,
          },
        }),
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

/**
 * GET /api/demo-day/:eventId/qr/:teamId
 * Generate and return a QR code PNG for a specific team.
 */
http.route({
  path: "/api/demo-day/qr",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const eventId = url.searchParams.get("eventId");
      const teamId = url.searchParams.get("teamId");

      if (!eventId || !teamId) {
        return new Response(
          JSON.stringify({
            error: "Missing eventId or teamId query parameters",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Call the QR code generation action
      const result = await ctx.runAction(api.qrCodes.generateTeamQrCode, {
        eventId: eventId as Id<"events">,
        teamId: teamId as Id<"teams">,
      });

      if (!result.success || !result.qrCodeBase64) {
        return new Response(
          JSON.stringify({
            error: result.error || "Failed to generate QR code",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Convert base64 data URL to binary
      const base64Data = result.qrCodeBase64.replace(
        /^data:[^;]+;base64,/,
        "",
      );
      const binaryData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0),
      );

      return new Response(binaryData, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `inline; filename="${result.teamName || "team"}_qr.svg"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

export default http;
