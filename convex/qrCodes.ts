"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import QRCode from "qrcode";
import JSZip from "jszip";

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
  demoDayRound?: number;
  demoDayBoardNumber?: string;
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
 * Generate an SVG QR code with embedded labels (large format for printing)
 */
async function generateLabeledQrSvg(
  url: string,
  teamName: string,
  courseCode: string | undefined,
  eventName: string
): Promise<string> {
  // Generate QR code as SVG string
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });

  // Extract the viewBox to get the QR code's native size
  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const qrNativeSize = viewBoxMatch ? parseInt(viewBoxMatch[1]) : 33;

  // Extract the path elements from the QR code
  const pathMatch = qrSvg.match(/<path[^>]*\/>/g);
  const paths = pathMatch ? pathMatch.join("\n") : "";

  // Calculate scale factor to make QR code fill desired size (500x500 for large print)
  const qrTargetSize = 500;
  const scaleFactor = qrTargetSize / qrNativeSize;

  // Truncate text if too long
  const maxLength = 50;
  const displayTeamName =
    teamName.length > maxLength
      ? teamName.slice(0, maxLength - 3) + "..."
      : teamName;
  const displayEventName =
    eventName.length > maxLength
      ? eventName.slice(0, maxLength - 3) + "..."
      : eventName;

  // Calculate positions - much larger SVG for print
  const svgWidth = 600;
  const svgHeight = 700;
  const qrX = (svgWidth - qrTargetSize) / 2; // Center horizontally
  const qrY = courseCode ? 80 : 40; // Leave room for course code if present

  // Create a complete SVG with text labels - large format for printing (2 per page)
  const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
  <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
  
  <!-- Course Code -->
  ${courseCode ? `<text x="${svgWidth / 2}" y="50" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="#333333">${escapeXml(courseCode)}</text>` : ""}
  
  <!-- QR Code - centered and scaled -->
  <g transform="translate(${qrX}, ${qrY}) scale(${scaleFactor})">
    ${paths}
  </g>
  
  <!-- Team Name -->
  <text x="${svgWidth / 2}" y="${svgHeight - 70}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="#000000">${escapeXml(displayTeamName)}</text>
  
  <!-- Event Name -->
  <text x="${svgWidth / 2}" y="${svgHeight - 25}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#666666">${escapeXml(displayEventName)}</text>
</svg>`;

  return fullSvg;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a bare QR code SVG (no labels) for layouts where text sits outside.
 */
async function generatePlainQrSvg(url: string): Promise<string> {
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });

  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const qrNativeSize = viewBoxMatch ? parseInt(viewBoxMatch[1]) : 33;
  const paths = qrSvg.match(/<path[^>]*\/>/g)?.join("\n") ?? "";

  const targetSize = 220;
  const svgWidth = targetSize;
  const svgHeight = targetSize;
  const scaleFactor = targetSize / qrNativeSize;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
  <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
  <g transform="translate(0, 0) scale(${scaleFactor})">
    ${paths}
  </g>
</svg>`;
}

/**
 * Generate a printable HTML page with all QR codes, grouped by course
 */
function generatePrintableHtml(
  eventName: string,
  qrCodes: Array<{
    teamName: string;
    courseCode?: string;
    svg: string;
    url: string;
  }>
): string {
  // Group QR codes by course
  const courseGroups = new Map<string, typeof qrCodes>();
  for (const qr of qrCodes) {
    const course = qr.courseCode || "General";
    if (!courseGroups.has(course)) {
      courseGroups.set(course, []);
    }
    courseGroups.get(course)!.push(qr);
  }

  // Sort courses alphabetically
  const sortedCourses = Array.from(courseGroups.keys()).sort();

  // Generate HTML for each course section
  const courseSectionsHtml = sortedCourses
    .map((course, courseIndex) => {
      const codes = courseGroups.get(course)!;
      const cardsHtml = codes
        .map(
          (qr) => `
        <div class="qr-card">
          ${qr.svg}
        </div>`
        )
        .join("\n");

      return `
      <section class="course-section ${courseIndex > 0 ? "page-break-before" : ""}">
        <h2 class="course-header">${escapeXml(course)}</h2>
        <div class="qr-grid">
          ${cardsHtml}
        </div>
      </section>`;
    })
    .join("\n");

  // Generate table of contents
  const tocHtml = sortedCourses
    .map((course) => {
      const count = courseGroups.get(course)!.length;
      return `<li><a href="#course-${createSlug(course)}">${escapeXml(course)}</a> (${count} project${count !== 1 ? "s" : ""})</li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Codes - ${escapeXml(eventName)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 10px;
      color: #333;
      font-size: 28px;
    }
    
    .instructions {
      text-align: center;
      margin-bottom: 20px;
      color: #666;
      font-size: 14px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .toc {
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .toc h3 {
      margin-bottom: 10px;
      color: #333;
    }
    
    .toc ul {
      list-style: none;
      padding: 0;
    }
    
    .toc li {
      padding: 5px 0;
    }
    
    .toc a {
      color: #0066cc;
      text-decoration: none;
    }
    
    .toc a:hover {
      text-decoration: underline;
    }
    
    .course-section {
      margin-bottom: 40px;
    }
    
    .course-header {
      text-align: center;
      font-size: 24px;
      color: #333;
      margin-bottom: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .qr-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 30px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .qr-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      padding: 15px;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 320px;
      height: 380px;
    }
    
    .qr-card svg {
      width: 100%;
      height: 100%;
      max-width: 290px;
      max-height: 350px;
    }
    
    /* Print styles - 2 per page, LARGE and centered vertically */
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      
      h1, .instructions, .toc, .course-header {
        display: none !important;
      }
      
      .course-section {
        margin: 0;
        padding: 0;
      }
      
      .page-break-before {
        page-break-before: auto;
      }
      
      .qr-grid {
        display: block;
        max-width: 100%;
        padding: 0;
        margin: 0;
      }
      
      .qr-card {
        box-shadow: none;
        border: 3px solid #000;
        border-radius: 12px;
        padding: 20px;
        margin: 0 auto 20px auto;
        width: 100%;
        max-width: 7in;
        height: 4.6in;
        display: flex;
        justify-content: center;
        align-items: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      .qr-card svg {
        width: 100% !important;
        height: 100% !important;
        max-width: 100%;
        max-height: 100%;
      }
      
      /* Force page break after every 2nd card */
      .qr-card:nth-child(2n) {
        page-break-after: always;
        break-after: page;
        margin-bottom: 0;
      }
    }
    
    @page {
      size: letter;
      margin: 0.4in;
    }
  </style>
</head>
<body>
  <h1>QR Codes - ${escapeXml(eventName)}</h1>
  <p class="instructions">
    Press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to print.<br>
    QR codes are organized by course, 2 per page for easy scanning.
  </p>
  
  <div class="toc">
    <h3>Courses</h3>
    <ul>
      ${tocHtml}
    </ul>
  </div>
  
  ${courseSectionsHtml}
</body>
</html>`;
}

/**
 * Generate a printable HTML page with QR codes grouped by board number.
 * Each page has 3 horizontal sections (one per round), sorted by round.
 */
function generateBoardGroupedHtml(
  eventName: string,
  qrCodes: Array<{
    teamName: string;
    courseCode?: string;
    svg: string;
    plainSvg?: string;
    url: string;
    demoDayRound?: number;
    demoDayBoardNumber?: string;
  }>
): string {
  // Group QR codes by board number
  const boardGroups = new Map<string, Array<(typeof qrCodes)[0]>>();

  for (const qr of qrCodes) {
    const board = qr.demoDayBoardNumber || "Unassigned";
    if (!boardGroups.has(board)) {
      boardGroups.set(board, []);
    }
    boardGroups.get(board)!.push(qr);
  }

  // Sort boards alphabetically
  const sortedBoards = Array.from(boardGroups.keys()).sort();

  // Generate HTML for each board page
  const boardPagesHtml = sortedBoards
    .map((board, boardIndex) => {
      const boardTeams = boardGroups.get(board)!;
      // Sort by round (earliest first)
      boardTeams.sort((a, b) => (a.demoDayRound || 0) - (b.demoDayRound || 0));

      // Generate the 3 horizontal sections
      const sectionsHtml = boardTeams
        .map((qr) => {
          const roundLabel = qr.demoDayRound ? `Round ${qr.demoDayRound}` : "";
          const courseLabel = qr.courseCode || "";
          return `
          <div class="team-section">
            <div class="qr-container">
              ${qr.plainSvg || qr.svg}
            </div>
            <div class="team-info">
              <div class="round-badge">${escapeXml(roundLabel)}</div>
              <div class="team-name">${escapeXml(qr.teamName)}</div>
              <div class="course-code">${escapeXml(courseLabel)}</div>
            </div>
          </div>`;
        })
        .join("\n");

      return `
      <div class="board-page ${boardIndex > 0 ? "page-break-before" : ""}">
        <div class="board-header">Board ${escapeXml(board)}</div>
        <div class="teams-container">
          ${sectionsHtml}
        </div>
      </div>`;
    })
    .join("\n");

  // Generate table of contents
  const tocHtml = sortedBoards
    .map((board) => {
      const count = boardGroups.get(board)!.length;
      const teams = boardGroups
        .get(board)!
        .sort((a, b) => (a.demoDayRound || 0) - (b.demoDayRound || 0))
        .map(
          (t) =>
            `R${t.demoDayRound || "?"}: ${t.teamName.slice(0, 30)}${t.teamName.length > 30 ? "..." : ""}`
        )
        .join(", ");
      return `<li><strong>Board ${escapeXml(board)}</strong> (${count} teams)<br><small>${escapeXml(teams)}</small></li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Codes by Board - ${escapeXml(eventName)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 10px;
      color: #333;
      font-size: 28px;
    }
    
    .instructions {
      text-align: center;
      margin-bottom: 20px;
      color: #666;
      font-size: 14px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .toc {
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .toc h3 {
      margin-bottom: 15px;
      color: #333;
    }
    
    .toc ul {
      list-style: none;
      padding: 0;
      columns: 2;
      column-gap: 30px;
    }
    
    .toc li {
      padding: 8px 0;
      break-inside: avoid;
    }
    
    .toc small {
      color: #666;
      font-size: 11px;
    }
    
    .board-page {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .board-header {
      text-align: center;
      font-size: 32px;
      font-weight: bold;
      color: #333;
      margin-bottom: 20px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 8px;
    }
    
    .teams-container {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .team-section {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 15px;
      border: 2px solid #ddd;
      border-radius: 8px;
      background: #fafafa;
    }
    
    .qr-container {
      flex-shrink: 0;
      width: 200px;
      height: 200px;
    }
    
    .qr-container svg {
      width: 100%;
      height: 100%;
    }
    
    .team-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .round-badge {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      width: fit-content;
    }
    
    .team-name {
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }
    
    .course-code {
      font-size: 16px;
      color: #666;
    }
    
    /* Print styles - 1 board per page with 3 horizontal sections */
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      
      h1, .instructions, .toc {
        display: none !important;
      }
      
      .board-page {
        box-shadow: none;
        border: none;
        padding: 0.3in;
        margin: 0;
        page-break-after: always;
        break-after: page;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .board-page:last-child {
        page-break-after: avoid;
      }
      
      .page-break-before {
        page-break-before: always;
      }
      
      .board-header {
        font-size: 36px;
        margin-bottom: 15px;
        padding: 8px;
        background: #000;
        color: white;
        border-radius: 0;
      }
      
      .teams-container {
        flex: 1;
        justify-content: space-between;
        gap: 10px;
      }
      
      .team-section {
        flex: 1;
        border: 3px solid #000;
        border-radius: 0;
        padding: 10px 15px;
        gap: 15px;
      }
      
      .qr-container {
        width: 2.2in;
        height: 2.2in;
      }
      
      .round-badge {
        font-size: 18px;
        padding: 6px 16px;
        background: #000;
      }
      
      .team-name {
        font-size: 18px;
      }
      
      .course-code {
        font-size: 14px;
      }
    }
    
    @page {
      size: letter;
      margin: 0.3in;
    }
  </style>
</head>
<body>
  <h1>QR Codes by Board - ${escapeXml(eventName)}</h1>
  <p class="instructions">
    Press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to print.<br>
    Each page corresponds to one board with 3 teams (one per round), sorted by round.
  </p>
  
  <div class="toc">
    <h3>Boards (${sortedBoards.length} total)</h3>
    <ul>
      ${tocHtml}
    </ul>
  </div>
  
  ${boardPagesHtml}
</body>
</html>`;
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

    // Build the appreciation URL: /event/:eventId/team/:teamId
    const appreciationUrl: string = `${args.baseUrl}/event/${args.eventId}/team/${args.teamId}`;

    try {
      // Generate labeled SVG QR code
      const svg = await generateLabeledQrSvg(
        appreciationUrl,
        team.name,
        team.courseCode,
        event.name
      );

      // Convert SVG to base64 data URL
      const qrCodeBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

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
 * Returns a base64-encoded ZIP file with SVG files and a printable HTML.
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

      const qrCodesForHtml: Array<{
        teamName: string;
        courseCode?: string;
        svg: string;
        plainSvg?: string;
        url: string;
        demoDayRound?: number;
        demoDayBoardNumber?: string;
      }> = [];

      for (const team of teams) {
        if (team.hidden) continue;

        // Create a slug from the team name for filename
        const teamSlug = createSlug(team.name);

        // Build filename (now SVG)
        const coursePrefix: string = team.courseCode || "general";
        const qrFilename: string = `${coursePrefix}_${teamSlug}_${team._id.slice(-4)}.svg`;

        // Build appreciation URL: /event/:eventId/team/:teamId
        const appreciationUrl: string = `${args.baseUrl}/event/${args.eventId}/team/${team._id}`;

        // Generate labeled SVG QR code
        const svg = await generateLabeledQrSvg(
          appreciationUrl,
          team.name,
          team.courseCode,
          event.name
        );
        const plainSvg = await generatePlainQrSvg(appreciationUrl);

        // Add to ZIP
        qrFolder?.file(qrFilename, svg);

        // Collect for HTML
        qrCodesForHtml.push({
          teamName: team.name,
          courseCode: team.courseCode,
          svg,
          plainSvg,
          url: appreciationUrl,
          demoDayRound: team.demoDayRound,
          demoDayBoardNumber: team.demoDayBoardNumber,
        });

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

      // Create printable HTML file (grouped by course)
      const printableHtml = generatePrintableHtml(event.name, qrCodesForHtml);
      zip.file("print-by-course.html", printableHtml);

      // Create board-grouped HTML file (3 teams per page, sorted by round)
      const boardGroupedHtml = generateBoardGroupedHtml(
        event.name,
        qrCodesForHtml
      );
      zip.file("print-by-board.html", boardGroupedHtml);

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
