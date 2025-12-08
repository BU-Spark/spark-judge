"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import QRCode from "qrcode";
import JSZip from "jszip";
import Jimp from "jimp";

// Type definitions for query results
type EventResult = {
  _id: Id<"events">;
  name: string;
  mode?: "hackathon" | "demo_day";
} | null;

type TeamResult = {
  _id: Id<"teams">;
  eventId: Id<"events">;
  name: string;
  courseCode?: string;
  hidden?: boolean;
} | null;

type TeamsResult = Array<{
  _id: Id<"teams">;
  eventId: Id<"events">;
  name: string;
  courseCode?: string;
  hidden?: boolean;
}>;

/**
 * Create a slug from a string (for URLs)
 */
function createSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a labeled QR code image with text using Jimp
 * Returns a PNG buffer
 */
async function generateLabeledQrCode(
  url: string,
  teamName: string,
  courseCode: string | undefined,
  eventName: string
): Promise<Buffer> {
  // Canvas dimensions
  const width = 500;
  const height = 650;
  const qrSize = 380;
  const padding = 20;

  // Generate QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(url, {
    type: "png",
    width: qrSize,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });

  // Load QR code image
  const qrImage = await Jimp.read(qrBuffer);

  // Create the main canvas with white background
  const canvas = new Jimp(width, height, 0xffffffff);

  // Load font for text
  const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

  // Calculate QR position (centered horizontally)
  const qrX = Math.floor((width - qrSize) / 2);
  const qrY = 100;

  // Composite QR code onto canvas
  canvas.composite(qrImage, qrX, qrY);

  // Add course code at top (centered)
  if (courseCode) {
    const courseWidth = Jimp.measureText(fontLarge, courseCode);
    const courseX = Math.floor((width - courseWidth) / 2);
    canvas.print(fontLarge, courseX, 30, courseCode);
  }

  // Add team name below QR code (centered, with truncation if needed)
  let displayName = teamName;
  const maxTextWidth = width - padding * 2;

  // Truncate team name if too long
  while (
    Jimp.measureText(fontLarge, displayName) > maxTextWidth &&
    displayName.length > 3
  ) {
    displayName = displayName.slice(0, -4) + "...";
  }

  const teamNameWidth = Jimp.measureText(fontLarge, displayName);
  const teamNameX = Math.floor((width - teamNameWidth) / 2);
  const teamNameY = qrY + qrSize + 30;
  canvas.print(fontLarge, teamNameX, teamNameY, displayName);

  // Add event name at bottom (centered, gray-ish by using smaller font)
  let displayEventName = eventName;
  while (
    Jimp.measureText(fontMedium, displayEventName) > maxTextWidth &&
    displayEventName.length > 3
  ) {
    displayEventName = displayEventName.slice(0, -4) + "...";
  }

  const eventNameWidth = Jimp.measureText(fontMedium, displayEventName);
  const eventNameX = Math.floor((width - eventNameWidth) / 2);
  const eventNameY = teamNameY + 50;
  canvas.print(fontMedium, eventNameX, eventNameY, displayEventName);

  // Add a subtle border (draw rectangles on edges)
  const borderColor = 0xccccccff;
  for (let i = 0; i < 2; i++) {
    // Top border
    for (let x = 0; x < width; x++) {
      canvas.setPixelColor(borderColor, x, i);
    }
    // Bottom border
    for (let x = 0; x < width; x++) {
      canvas.setPixelColor(borderColor, x, height - 1 - i);
    }
    // Left border
    for (let y = 0; y < height; y++) {
      canvas.setPixelColor(borderColor, i, y);
    }
    // Right border
    for (let y = 0; y < height; y++) {
      canvas.setPixelColor(borderColor, width - 1 - i, y);
    }
  }

  // Return as PNG buffer
  return await canvas.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * Generate a QR code PNG for a specific team's appreciation URL.
 * Returns a base64-encoded PNG image with labels.
 */
export const generateTeamQrCode = action({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
    baseUrl: v.string(), // The base URL for the appreciation page
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    qrCodeBase64: v.optional(v.string()),
    teamName: v.optional(v.string()),
    courseCode: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    error?: string;
    qrCodeBase64?: string;
    teamName?: string;
    courseCode?: string;
  }> => {
    // Fetch event and team data
    const event: EventResult = await ctx.runQuery(
      internal.qrCodesQueries.getEventInternal,
      {
        eventId: args.eventId,
      }
    );

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.mode !== "demo_day") {
      return { success: false, error: "Event is not in Demo Day mode" };
    }

    const team: TeamResult = await ctx.runQuery(
      internal.qrCodesQueries.getTeamInternal,
      {
        teamId: args.teamId,
      }
    );

    if (!team || team.eventId !== args.eventId) {
      return { success: false, error: "Team not found" };
    }

    // Create slugs for readable URLs
    const eventSlug = createSlug(event.name);
    const teamSlug = createSlug(team.name);

    // Build the appreciation URL: /event/:eventSlug/:teamSlug/:teamId
    const appreciationUrl: string = `${args.baseUrl}/event/${eventSlug}/${teamSlug}/${args.teamId}`;

    try {
      // Generate labeled QR code
      const qrBuffer = await generateLabeledQrCode(
        appreciationUrl,
        team.name,
        team.courseCode,
        event.name
      );

      const qrCodeBase64 = `data:image/png;base64,${qrBuffer.toString("base64")}`;

      return {
        success: true,
        qrCodeBase64,
        teamName: team.name,
        courseCode: team.courseCode || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate QR code",
      };
    }
  },
});

/**
 * Generate a ZIP file containing all labeled QR codes for an event.
 * Returns a base64-encoded ZIP file.
 */
export const generateQrCodeZip = action({
  args: {
    eventId: v.id("events"),
    baseUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    zipBase64: v.optional(v.string()),
    filename: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    error?: string;
    zipBase64?: string;
    filename?: string;
  }> => {
    // Fetch event data
    const event: EventResult = await ctx.runQuery(
      internal.qrCodesQueries.getEventInternal,
      {
        eventId: args.eventId,
      }
    );

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.mode !== "demo_day") {
      return { success: false, error: "Event is not in Demo Day mode" };
    }

    // Get all teams for this event
    const teams: TeamsResult = await ctx.runQuery(
      internal.qrCodesQueries.getTeamsInternal,
      {
        eventId: args.eventId,
      }
    );

    if (teams.length === 0) {
      return { success: false, error: "No teams found for this event" };
    }

    // Create event slug for URLs
    const eventSlug = createSlug(event.name);

    try {
      const zip = new JSZip();
      const qrFolder = zip.folder("qr-codes");
      const csvRows: string[][] = [
        [
          "teamId",
          "courseCode",
          "teamName",
          "slug",
          "qrFilename",
          "appreciationUrl",
        ],
      ];

      for (const team of teams) {
        if (team.hidden) continue;

        // Create a slug from the team name
        const teamSlug = createSlug(team.name);

        // Build filename
        const coursePrefix: string = team.courseCode || "general";
        const qrFilename: string = `${coursePrefix}_${teamSlug}_${team._id.slice(-4)}.png`;

        // Build appreciation URL: /event/:eventSlug/:teamSlug/:teamId
        const appreciationUrl: string = `${args.baseUrl}/event/${eventSlug}/${teamSlug}/${team._id}`;

        // Generate labeled QR code
        const qrBuffer = await generateLabeledQrCode(
          appreciationUrl,
          team.name,
          team.courseCode,
          event.name
        );

        // Add to ZIP
        qrFolder?.file(qrFilename, qrBuffer);

        // Add to CSV data
        csvRows.push([
          team._id,
          team.courseCode || "",
          team.name,
          teamSlug,
          qrFilename,
          appreciationUrl,
        ]);
      }

      // Create CSV content
      const csvContent: string = csvRows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
      zip.file("projects.csv", csvContent);

      // Generate ZIP as base64
      const zipBuffer: Buffer = await zip.generateAsync({ type: "nodebuffer" });
      const zipBase64: string = zipBuffer.toString("base64");

      // Create filename
      const filename: string = `${eventSlug}_qr-codes.zip`;

      return {
        success: true,
        zipBase64,
        filename,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate ZIP",
      };
    }
  },
});
