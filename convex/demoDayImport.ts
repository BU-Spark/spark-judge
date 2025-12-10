import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
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
        // Ignore bare \r, handle \r\n as newline
        if (text[i + 1] === "\n") {
          pushRow();
          i += 1;
        }
      } else {
        current += char;
      }
    }
  }

  // Flush last cell/row
  pushRow();

  if (rows.length === 0) return [];
  const [headers, ...data] = rows;
  return data.map((cols) => {
    const rowObj: CsvRow = {};
    headers.forEach((header, idx) => {
      rowObj[header.trim()] = (cols[idx] ?? "").trim();
    });
    return rowObj;
  });
}

export const importDemoDayEventFromCSVs = mutation({
  args: {
    assignmentsCsv: v.string(),
    projectsCsv: v.string(),
    eventName: v.optional(v.string()),
    eventDescription: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("upcoming"), v.literal("active"), v.literal("past"))
    ),
  },
  returns: v.object({
    eventId: v.id("events"),
    teamsCreated: v.number(),
    teamNamesWithDuplicates: v.array(v.string()),
    skipped: v.array(
      v.object({
        projectInstance: v.string(),
        reason: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    const assignments = parseCsv(args.assignmentsCsv);
    const projects = parseCsv(args.projectsCsv);

    const projectMap: Record<
      string,
      { name: string; github: string; course: string }
    > = {};
    for (const row of projects) {
      const instances = (row["Project Instances"] || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const name = row["Project Name"] || "";
      const github = row["GitHub Repo"] || "";
      const course = row["Course (from Project Instances)"] || "";
      for (const inst of instances) {
        projectMap[inst] = { name, github, course };
      }
    }

    const grouped: Record<string, { members: Set<string>; course: string }> =
      {};
    const skipped: Array<{ projectInstance: string; reason: string }> = [];
    for (const row of assignments) {
      if (
        (row["Semester (from Project Instance)"] || "").toLowerCase() !==
        "fall 2025"
      ) {
        continue;
      }
      const projectInstance = row["Project Instance"] || "";
      const contributor = row["Contributor"] || "";
      const course = row["Course (from Project Instance)"] || "";
      if (!projectInstance) {
        skipped.push({
          projectInstance: "",
          reason: "Missing project instance in assignments row",
        });
        continue;
      }
      if (!projectMap[projectInstance]) {
        skipped.push({
          projectInstance,
          reason: "Project instance not found in projects CSV",
        });
        continue;
      }
      if (!grouped[projectInstance]) {
        grouped[projectInstance] = {
          members: new Set<string>(),
          course,
        };
      }
      if (contributor) {
        grouped[projectInstance].members.add(contributor);
      }
    }

    const courseCodes = new Set<string>();
    Object.values(grouped).forEach(({ course }) => {
      if (course) courseCodes.add(course);
    });

    const now = Date.now();
    const defaultStart = now + 24 * 60 * 60 * 1000;
    const defaultEnd = defaultStart + 24 * 60 * 60 * 1000;

    const eventId = await ctx.db.insert("events", {
      name: args.eventName || "Demo Day Fall 2025",
      description: args.eventDescription ?? "",
      status: args.status || "upcoming",
      startDate: args.startDate ?? defaultStart,
      endDate: args.endDate ?? defaultEnd,
      categories: [{ name: "Demo Day", weight: 1 }],
      tracks: [],
      judgeCode: undefined,
      enableCohorts: false,
      mode: "demo_day",
      courseCodes: Array.from(courseCodes),
      resultsReleased: false,
    });

    const seenNames = new Set<string>();
    const duplicateNames: string[] = [];
    let teamsCreated = 0;

    for (const [projectInstance, data] of Object.entries(grouped)) {
      const project = projectMap[projectInstance];
      if (!project) continue;

      const name = project.name || projectInstance;
      if (seenNames.has(name)) {
        duplicateNames.push(name);
      } else {
        seenNames.add(name);
      }

      const github =
        project.github.startsWith("http://") ||
        project.github.startsWith("https://")
          ? project.github
          : "";

      await ctx.db.insert("teams", {
        eventId,
        name,
        description: "",
        members: Array.from(data.members),
        githubUrl: github,
        projectUrl: github,
        track: "",
        courseCode: data.course || project.course || undefined,
        submittedBy: userId,
        submittedAt: now,
      });
      teamsCreated += 1;
    }

    return {
      eventId,
      teamsCreated,
      teamNamesWithDuplicates: duplicateNames,
      skipped,
    };
  },
});
