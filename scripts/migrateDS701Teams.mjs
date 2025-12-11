#!/usr/bin/env node
// Migrate DS701 teams to add (Team A) or (Team B) suffix based on project instance
// Usage:
//   node scripts/migrateDS701Teams.mjs "/path/Assignments.csv"

import fs from "fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(current);
    current = "";
  };

  const pushRow = () => {
    if (row.length > 0 || current.length > 0) {
      pushCell();
      rows.push(row);
      row = [];
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        pushCell();
      } else if (char === "\n") {
        pushRow();
      } else if (char === "\r") {
        if (text[i + 1] === "\n") {
          pushRow();
          i += 1;
        }
      } else {
        current += char;
      }
    }
  }
  pushRow();

  if (rows.length === 0) return [];
  const [headers, ...data] = rows;
  return data.map((cols) => {
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header.trim()] = (cols[idx] ?? "").trim();
    });
    return rowObj;
  });
}

async function main() {
  const [assignmentsPath] = process.argv.slice(2);
  if (!assignmentsPath) {
    console.error(
      "Usage: node scripts/migrateDS701Teams.mjs <assignments.csv>"
    );
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL || "https://mild-loris-998.convex.cloud";
  const eventId = "jx7501rxjr2kwqy1gdve7sv52n7x1bhp"; // Demo Day Fall 2025

  // Parse assignments CSV
  const assignmentsCsv = await fs.readFile(assignmentsPath, "utf8");
  const assignments = parseCsv(assignmentsCsv);

  // Build map: project instance -> set of member names (for Fall 2025, DS701 only)
  const instanceMembers = {};
  for (const row of assignments) {
    const semester = (
      row["Semester (from Project Instance)"] || ""
    ).toLowerCase();
    const course = row["Course (from Project Instance)"] || "";
    if (semester !== "fall 2025" || course !== "DS701") continue;

    const instance = row["Project Instance"] || "";
    const contributor = row["Contributor"] || "";
    if (!instance || !contributor) continue;

    if (!instanceMembers[instance]) {
      instanceMembers[instance] = new Set();
    }
    instanceMembers[instance].add(contributor);
  }

  console.log(
    "DS701 project instances found:",
    Object.keys(instanceMembers).length
  );

  // Get teams from Convex
  const client = new ConvexHttpClient(convexUrl);
  const teams = await client.query(api.teams.listTeams, { eventId });
  const ds701Teams = teams.filter((t) => t.courseCode === "DS701");

  console.log("DS701 teams in Convex:", ds701Teams.length);

  // For each team, find which project instance it belongs to by matching members
  const updates = [];
  for (const team of ds701Teams) {
    const teamMembers = new Set(team.members);

    // Find the instance with the most member overlap
    let bestMatch = null;
    let bestOverlap = 0;
    for (const [instance, members] of Object.entries(instanceMembers)) {
      const overlap = [...teamMembers].filter((m) => members.has(m)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = instance;
      }
    }

    if (!bestMatch) {
      console.log(`No match for team: ${team.name}`);
      continue;
    }

    // Determine A or B suffix
    let suffix = "";
    if (bestMatch.endsWith("-a")) {
      suffix = " (Team A)";
    } else if (bestMatch.endsWith("-b")) {
      suffix = " (Team B)";
    }

    if (suffix && !team.name.includes("(Team")) {
      const newName = team.name + suffix;
      updates.push({
        teamId: team._id,
        oldName: team.name,
        newName,
        instance: bestMatch,
      });
    }
  }

  console.log("\nUpdates to make:", updates.length);
  for (const u of updates) {
    console.log(`  ${u.oldName} -> ${u.newName} (${u.instance})`);
  }

  if (updates.length === 0) {
    console.log("No updates needed.");
    return;
  }

  const adminSecret = process.env.DEMO_DAY_IMPORT_SECRET;
  if (!adminSecret) {
    console.error("Set DEMO_DAY_IMPORT_SECRET to apply updates.");
    process.exit(1);
  }

  console.log("\nApplying updates...");
  for (const u of updates) {
    await client.mutation(api.demoDayImport.renameTeam, {
      teamId: u.teamId,
      newName: u.newName,
      adminSecret,
    });
    console.log(`  ✓ ${u.newName}`);
  }

  console.log("\nDone! Renamed", updates.length, "teams.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
