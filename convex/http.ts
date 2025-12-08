import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

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
      const body = await req.json();
      const { eventId, teamId, attendeeId, fingerprintKey } = body as {
        eventId: string;
        teamId: string;
        attendeeId: string;
        fingerprintKey: string;
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
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Extract IP and User-Agent from request
      const ipAddress = getClientIp(req);
      const userAgent = req.headers.get("user-agent") || "unknown";

      // Call the internal mutation with trusted metadata
      const result = await ctx.runMutation(
        internal.appreciations.createAppreciationInternal,
        {
          eventId: eventId as Id<"events">,
          teamId: teamId as Id<"teams">,
          attendeeId,
          fingerprintKey,
          ipAddress,
          userAgent,
        }
      );

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Error creating appreciation:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
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
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
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
          }
        );
      }

      // Get the origin for building the appreciation URL
      const origin =
        url.origin || req.headers.get("origin") || "https://example.com";
      // Replace .convex.site with the actual frontend URL if needed
      const baseUrl = origin.replace(".convex.site", ".vercel.app");

      // Call the QR code generation action
      const result = await ctx.runAction(api.qrCodes.generateTeamQrCode, {
        eventId: eventId as Id<"events">,
        teamId: teamId as Id<"teams">,
        baseUrl,
      });

      if (!result.success || !result.qrCodeBase64) {
        return new Response(
          JSON.stringify({
            error: result.error || "Failed to generate QR code",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Convert base64 data URL to binary
      const base64Data = result.qrCodeBase64.replace(
        /^data:image\/png;base64,/,
        ""
      );
      const binaryData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      return new Response(binaryData, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `inline; filename="${result.teamName || "team"}_qr.png"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
