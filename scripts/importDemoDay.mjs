#!/usr/bin/env node
// Import Demo Day data from local CSV files by calling the Convex mutation.
// Usage:
//   CONVEX_URL="https://<your>.convex.cloud" \
//   DEMO_DAY_IMPORT_SECRET="<secret>" \
//   node scripts/importDemoDay.mjs "/path/Assignments.csv" "/path/Projects.csv"

import fs from "fs/promises";
import process from "process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

async function main() {
  const [assignmentsPath, projectsPath] = process.argv.slice(2);
  if (!assignmentsPath || !projectsPath) {
    console.error(
      "Usage: node scripts/importDemoDay.mjs <assignments.csv> <projects.csv>"
    );
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL || process.env.CONVEX_DEPLOYMENT;
  if (!convexUrl) {
    console.error("Set CONVEX_URL (or CONVEX_DEPLOYMENT) to your Convex URL.");
    process.exit(1);
  }

  const adminSecret = process.env.DEMO_DAY_IMPORT_SECRET;
  if (!adminSecret) {
    console.warn(
      "Warning: DEMO_DAY_IMPORT_SECRET not set; import will require admin auth."
    );
  }

  const [assignmentsCsv, projectsCsv] = await Promise.all([
    fs.readFile(assignmentsPath, "utf8"),
    fs.readFile(projectsPath, "utf8"),
  ]);

  const client = new ConvexHttpClient(convexUrl);
  const result = await client.mutation(
    api.demoDayImport.importDemoDayEventFromCSVs,
    {
      assignmentsCsv,
      projectsCsv,
      adminSecret,
    }
  );

  console.log("Import complete:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
