import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { isDemoDayMode } from "./eventModes";
import type { Doc, Id } from "./_generated/dataModel";

type CsvRow = Record<string, string>;
type AirtableRecord = { id: string; fields: Record<string, unknown> };
type ImportSource = "airtable" | "csv";

export const DEMO_DAY_IMPORT_FIELD_NAMES = {
  assignmentSemester: "Semester (from Project Instance)",
  assignmentProjectInstance: "Project Instance",
  assignmentContributor: "Contributor",
  assignmentCourse: "Course (from Project Instance)",
  projectInstanceName: "Name",
  projectInstanceProject: "Project",
  projectInstanceProjectName: "Project Name",
  projectInstanceSemester: "Semester",
  projectInstanceCourse: "Course",
  projectInstanceGithub: "GitHub Repo",
  projectInstances: "Project Instances",
  projectName: "Project Name",
  projectGithub: "GitHub Repo",
  projectCourse: "Course (from Project Instances)",
  recordId: "__recordId",
} as const;

type NormalizedDemoDayImportRow = {
  projectInstance: string;
  name: string;
  members: string[];
  courseCode?: string;
  projectUrl?: string;
  githubUrl?: string;
  airtableProjectRecordId?: string;
  airtableProjectInstanceRecordId?: string;
};

type ImportSkippedRow = {
  projectInstance: string;
  reason: string;
};

type BoardAssignment = {
  matchKey: string;
  projectInstance?: string;
  projectName?: string;
  signName?: string;
  fullSignName?: string;
  courseCode?: string;
  courseName?: string;
  time?: string;
  round: number;
  boardNumber: string;
};

type BoardManualMatch = {
  matchKey: string;
  teamId: Id<"teams">;
};

type TeamForImport = Pick<
  Doc<"teams">,
  | "_id"
  | "name"
  | "members"
  | "courseCode"
  | "projectUrl"
  | "githubUrl"
  | "hidden"
  | "demoDayProjectInstance"
  | "airtableProjectRecordId"
  | "airtableProjectInstanceRecordId"
  | "demoDaySignName"
  | "demoDayFullSignName"
  | "demoDayBoardTime"
  | "demoDayCourseName"
>;

const normalizedImportRowValidator = v.object({
  projectInstance: v.string(),
  name: v.string(),
  members: v.array(v.string()),
  courseCode: v.optional(v.string()),
  projectUrl: v.optional(v.string()),
  githubUrl: v.optional(v.string()),
  airtableProjectRecordId: v.optional(v.string()),
  airtableProjectInstanceRecordId: v.optional(v.string()),
});

const importSkippedRowValidator = v.object({
  projectInstance: v.string(),
  reason: v.string(),
});

const importPreviewItemValidator = v.object({
  action: v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("unchanged"),
  ),
  teamId: v.optional(v.id("teams")),
  projectInstance: v.string(),
  name: v.string(),
  courseCode: v.optional(v.string()),
  memberCount: v.number(),
  changes: v.array(v.string()),
});

const importPreviewReturnValidator = v.object({
  success: v.boolean(),
  configured: v.boolean(),
  source: v.union(v.literal("airtable"), v.literal("csv")),
  error: v.optional(v.string()),
  summary: v.object({
    createCount: v.number(),
    updateCount: v.number(),
    unchangedCount: v.number(),
    skipCount: v.number(),
    totalRows: v.number(),
  }),
  courseCodes: v.array(v.string()),
  duplicateNames: v.array(v.string()),
  creates: v.array(importPreviewItemValidator),
  updates: v.array(importPreviewItemValidator),
  unchanged: v.array(importPreviewItemValidator),
  skipped: v.array(importSkippedRowValidator),
});

const boardAssignmentValidator = v.object({
  matchKey: v.string(),
  projectInstance: v.optional(v.string()),
  projectName: v.optional(v.string()),
  signName: v.optional(v.string()),
  fullSignName: v.optional(v.string()),
  courseCode: v.optional(v.string()),
  courseName: v.optional(v.string()),
  time: v.optional(v.string()),
  round: v.number(),
  boardNumber: v.string(),
});

const boardInvalidRowValidator = v.object({
  rowNumber: v.number(),
  projectInstance: v.optional(v.string()),
  reason: v.string(),
});

const boardManualMatchValidator = v.object({
  matchKey: v.string(),
  teamId: v.id("teams"),
});

const boardCreateTeamValidator = v.object({
  matchKey: v.string(),
});

const boardUnmatchedRowValidator = v.object({
  matchKey: v.string(),
  projectInstance: v.optional(v.string()),
  projectName: v.optional(v.string()),
  signName: v.optional(v.string()),
  fullSignName: v.optional(v.string()),
  courseCode: v.optional(v.string()),
  courseName: v.optional(v.string()),
  time: v.optional(v.string()),
  round: v.number(),
  boardNumber: v.string(),
  reason: v.string(),
});

const boardPreviewReturnValidator = v.object({
  success: v.boolean(),
  summary: v.object({
    matchedCount: v.number(),
    unmatchedCount: v.number(),
    invalidCount: v.number(),
    duplicateCount: v.number(),
  }),
  matched: v.array(
    v.object({
      teamId: v.id("teams"),
      teamName: v.string(),
      matchKey: v.string(),
      projectInstance: v.optional(v.string()),
      projectName: v.optional(v.string()),
      signName: v.optional(v.string()),
      fullSignName: v.optional(v.string()),
      courseCode: v.optional(v.string()),
      courseName: v.optional(v.string()),
      time: v.optional(v.string()),
      round: v.number(),
      boardNumber: v.string(),
      previousRound: v.optional(v.number()),
      previousBoardNumber: v.optional(v.string()),
    }),
  ),
  unmatched: v.array(boardUnmatchedRowValidator),
  invalidRows: v.array(boardInvalidRowValidator),
  duplicateProjectInstances: v.array(v.string()),
});

export function parseCsv(text: string): CsvRow[] {
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

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAirtableCell(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) {
    return value.map(normalizeAirtableCell).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const maybeNamed = value as { name?: unknown; text?: unknown };
    if (typeof maybeNamed.name === "string") return maybeNamed.name;
    if (typeof maybeNamed.text === "string") return maybeNamed.text;
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function getValueByAliases(row: CsvRow, aliases: string[]) {
  const exactAliasSet = new Set(aliases.map((alias) => alias.toLowerCase()));
  for (const [header, value] of Object.entries(row)) {
    if (exactAliasSet.has(header.trim().toLowerCase())) return value.trim();
  }

  const normalizedAliasSet = new Set(aliases.map(normalizeHeader));
  for (const [header, value] of Object.entries(row)) {
    if (normalizedAliasSet.has(normalizeHeader(header))) return value.trim();
  }
  return "";
}

function airtableRecordsToRows(records: AirtableRecord[]): CsvRow[] {
  return records.map((record) => {
    const row: CsvRow = {
      [DEMO_DAY_IMPORT_FIELD_NAMES.recordId]: record.id,
    };
    for (const [field, value] of Object.entries(record.fields)) {
      row[field] = normalizeAirtableCell(value);
    }
    return row;
  });
}

function splitCsvList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value?: string) {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return undefined;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeMatchName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDemoDayImportRows({
  assignments,
  projectInstances = [],
  projects,
  semester,
}: {
  assignments: CsvRow[];
  projectInstances?: CsvRow[];
  projects: CsvRow[];
  semester: string;
}): {
  rows: NormalizedDemoDayImportRow[];
  skipped: ImportSkippedRow[];
  duplicateNames: string[];
} {
  const targetSemester = semester.trim().toLowerCase();
  const skipped: ImportSkippedRow[] = [];
  const projectMap: Record<
    string,
    {
      name: string;
      github?: string;
      course?: string;
      airtableProjectRecordId?: string;
      airtableProjectInstanceRecordId?: string;
    }
  > = {};
  const semesterProjectInstances = new Set<string>();

  for (const row of projectInstances) {
    const projectInstance = normalizeOptionalString(
      getValueByAliases(row, [
        "Project Instance",
        "Project Instance Name",
        "Instance",
        "Name",
      ]),
    );
    if (!projectInstance) continue;

    const instanceSemester = normalizeOptionalString(
      getValueByAliases(row, [
        DEMO_DAY_IMPORT_FIELD_NAMES.projectInstanceSemester,
        "Semester (from Project Instance)",
        "Semester (from Project)",
        "Semester (from Course)",
        "Semester (from Assignments)",
        "Term",
        "Academic Term",
      ]),
    );
    const belongsToTargetSemester =
      !!instanceSemester &&
      instanceSemester.trim().toLowerCase() === targetSemester;
    if (instanceSemester && !belongsToTargetSemester) {
      continue;
    }

    const projectName = normalizeOptionalString(
      getValueByAliases(row, [
        DEMO_DAY_IMPORT_FIELD_NAMES.projectInstanceProjectName,
        "Project Name (from Project)",
        "Project",
        "Project/Team Name",
      ]),
    );
    const course = normalizeOptionalString(
      getValueByAliases(row, [
        DEMO_DAY_IMPORT_FIELD_NAMES.projectInstanceCourse,
        "Course Code",
        "Course (from Project Instance)",
        "Course (from Project)",
        "Course (from Course)",
        "Course Code (from Course)",
        "Class",
        "Class Code",
      ]),
    );
    const github = normalizeUrl(
      getValueByAliases(row, [
        DEMO_DAY_IMPORT_FIELD_NAMES.projectInstanceGithub,
        "GitHub",
        "Github",
        "Repository",
        "Repository URL",
        "Project URL",
      ]),
    );
    const airtableProjectRecordId = normalizeOptionalString(
      getValueByAliases(row, [
        "Project Record ID",
        "Project Airtable Record ID",
      ]),
    );
    const airtableProjectInstanceRecordId = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.recordId],
    );

    projectMap[projectInstance] = {
      name: projectName || projectInstance,
      github,
      course,
      airtableProjectRecordId,
      airtableProjectInstanceRecordId,
    };
    if (belongsToTargetSemester) {
      semesterProjectInstances.add(projectInstance);
    }
  }

  for (const row of projects) {
    const instances = splitCsvList(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.projectInstances],
    );
    const name = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.projectName],
    );
    const github = normalizeUrl(row[DEMO_DAY_IMPORT_FIELD_NAMES.projectGithub]);
    const course = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.projectCourse],
    );
    const airtableProjectRecordId = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.recordId],
    );

    for (const instance of instances) {
      const existing = projectMap[instance];
      projectMap[instance] = {
        name: existing?.name || name || instance,
        github: existing?.github || github,
        course: existing?.course || course,
        airtableProjectRecordId:
          existing?.airtableProjectRecordId || airtableProjectRecordId,
        airtableProjectInstanceRecordId:
          existing?.airtableProjectInstanceRecordId,
      };
    }
  }

  const grouped: Record<string, { members: Set<string>; course?: string }> = {};

  for (const row of assignments) {
    const semesterValue = (
      row[DEMO_DAY_IMPORT_FIELD_NAMES.assignmentSemester] || ""
    )
      .trim()
      .toLowerCase();
    if (semesterValue !== targetSemester) continue;

    const projectInstance = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.assignmentProjectInstance],
    );
    const contributor = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.assignmentContributor],
    );
    const course = normalizeOptionalString(
      row[DEMO_DAY_IMPORT_FIELD_NAMES.assignmentCourse],
    );

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
        reason: "Project instance not found in projects data",
      });
      continue;
    }

    if (!grouped[projectInstance]) {
      grouped[projectInstance] = { members: new Set<string>(), course };
    }
    if (contributor) {
      grouped[projectInstance].members.add(contributor);
    }
    if (!grouped[projectInstance].course && course) {
      grouped[projectInstance].course = course;
    }
  }

  for (const projectInstance of semesterProjectInstances) {
    if (!grouped[projectInstance] && projectMap[projectInstance]) {
      grouped[projectInstance] = {
        members: new Set<string>(),
        course: projectMap[projectInstance].course,
      };
    }
  }

  const seenNames = new Set<string>();
  const duplicateNames: string[] = [];
  const rows: NormalizedDemoDayImportRow[] = [];

  for (const [projectInstance, data] of Object.entries(grouped)) {
    const project = projectMap[projectInstance];
    const name = project.name || projectInstance;
    const nameKey = name.trim().toLowerCase();
    if (seenNames.has(nameKey)) {
      duplicateNames.push(name);
    } else {
      seenNames.add(nameKey);
    }

    const normalizedRow: NormalizedDemoDayImportRow = {
      projectInstance,
      name,
      members: Array.from(data.members),
    };
    const courseCode = data.course || project.course;
    if (courseCode) normalizedRow.courseCode = courseCode;
    if (project.github) normalizedRow.projectUrl = project.github;
    if (project.github?.startsWith("https://github.com/")) {
      normalizedRow.githubUrl = project.github;
    }
    if (project.airtableProjectRecordId) {
      normalizedRow.airtableProjectRecordId = project.airtableProjectRecordId;
    }
    if (project.airtableProjectInstanceRecordId) {
      normalizedRow.airtableProjectInstanceRecordId =
        project.airtableProjectInstanceRecordId;
    }
    rows.push(normalizedRow);
  }

  rows.sort((a, b) => {
    const courseCompare = (a.courseCode || "").localeCompare(
      b.courseCode || "",
    );
    return courseCompare || a.name.localeCompare(b.name);
  });

  return { rows, skipped, duplicateNames: uniqueSorted(duplicateNames) };
}

function getTeamNameCourseKey(name: string, courseCode?: string) {
  return `${name.trim()}\u0000${(courseCode || "").trim()}`;
}

function getChangesForTeam(
  team: TeamForImport,
  row: NormalizedDemoDayImportRow,
) {
  const changes: string[] = [];
  if (team.name !== row.name) changes.push("name");
  if (JSON.stringify(team.members || []) !== JSON.stringify(row.members)) {
    changes.push("members");
  }
  if ((team.courseCode || "") !== (row.courseCode || "")) {
    changes.push("courseCode");
  }
  if ((team.projectUrl || "") !== (row.projectUrl || "")) {
    changes.push("projectUrl");
  }
  if ((team.githubUrl || "") !== (row.githubUrl || "")) {
    changes.push("githubUrl");
  }
  if ((team.demoDayProjectInstance || "") !== row.projectInstance) {
    changes.push("projectInstance");
  }
  if (
    row.airtableProjectRecordId !== undefined &&
    (team.airtableProjectRecordId || "") !== row.airtableProjectRecordId
  ) {
    changes.push("airtableRecord");
  }
  if (
    row.airtableProjectInstanceRecordId !== undefined &&
    (team.airtableProjectInstanceRecordId || "") !==
      row.airtableProjectInstanceRecordId
  ) {
    changes.push("airtableProjectInstanceRecord");
  }
  return changes;
}

function getTeamPatch(row: NormalizedDemoDayImportRow) {
  return {
    name: row.name,
    members: row.members,
    courseCode: row.courseCode,
    projectUrl: row.projectUrl || "",
    githubUrl: row.githubUrl || "",
    demoDayProjectInstance: row.projectInstance,
    ...(row.airtableProjectRecordId !== undefined
      ? { airtableProjectRecordId: row.airtableProjectRecordId }
      : {}),
    ...(row.airtableProjectInstanceRecordId !== undefined
      ? { airtableProjectInstanceRecordId: row.airtableProjectInstanceRecordId }
      : {}),
  };
}

function buildImportPlan({
  rows,
  existingTeams,
  skipped,
  duplicateNames,
}: {
  rows: NormalizedDemoDayImportRow[];
  existingTeams: TeamForImport[];
  skipped: ImportSkippedRow[];
  duplicateNames: string[];
}) {
  const byProjectInstance = new Map<string, TeamForImport>();
  const byNameCourse = new Map<string, TeamForImport>();

  for (const team of existingTeams) {
    if (team.demoDayProjectInstance) {
      byProjectInstance.set(team.demoDayProjectInstance, team);
    }
    byNameCourse.set(getTeamNameCourseKey(team.name, team.courseCode), team);
  }

  const creates: Array<{
    action: "create";
    row: NormalizedDemoDayImportRow;
    changes: string[];
  }> = [];
  const updates: Array<{
    action: "update";
    row: NormalizedDemoDayImportRow;
    team: TeamForImport;
    changes: string[];
  }> = [];
  const unchanged: Array<{
    action: "unchanged";
    row: NormalizedDemoDayImportRow;
    team: TeamForImport;
    changes: string[];
  }> = [];

  for (const row of rows) {
    const match =
      byProjectInstance.get(row.projectInstance) ||
      byNameCourse.get(getTeamNameCourseKey(row.name, row.courseCode));

    if (!match) {
      creates.push({ action: "create", row, changes: ["new team"] });
      continue;
    }

    const changes = getChangesForTeam(match, row);
    if (changes.length === 0) {
      unchanged.push({ action: "unchanged", row, team: match, changes: [] });
    } else {
      updates.push({ action: "update", row, team: match, changes });
    }
  }

  const courseCodes = uniqueSorted(
    rows.map((row) => row.courseCode || "").filter(Boolean),
  );

  return {
    creates,
    updates,
    unchanged,
    skipped,
    duplicateNames: uniqueSorted(duplicateNames),
    courseCodes,
  };
}

function formatImportItem(
  item:
    | { action: "create"; row: NormalizedDemoDayImportRow; changes: string[] }
    | {
        action: "update" | "unchanged";
        row: NormalizedDemoDayImportRow;
        team: TeamForImport;
        changes: string[];
      },
) {
  const result: {
    action: "create" | "update" | "unchanged";
    teamId?: Id<"teams">;
    projectInstance: string;
    name: string;
    courseCode?: string;
    memberCount: number;
    changes: string[];
  } = {
    action: item.action,
    projectInstance: item.row.projectInstance,
    name: item.row.name,
    memberCount: item.row.members.length,
    changes: item.changes,
  };
  if ("team" in item) result.teamId = item.team._id;
  if (item.row.courseCode) result.courseCode = item.row.courseCode;
  return result;
}

function formatImportPreview({
  configured,
  source,
  plan,
  success = true,
  error,
}: {
  configured: boolean;
  source: ImportSource;
  plan: ReturnType<typeof buildImportPlan>;
  success?: boolean;
  error?: string;
}) {
  const result: {
    success: boolean;
    configured: boolean;
    source: ImportSource;
    error?: string;
    summary: {
      createCount: number;
      updateCount: number;
      unchangedCount: number;
      skipCount: number;
      totalRows: number;
    };
    courseCodes: string[];
    duplicateNames: string[];
    creates: ReturnType<typeof formatImportItem>[];
    updates: ReturnType<typeof formatImportItem>[];
    unchanged: ReturnType<typeof formatImportItem>[];
    skipped: ImportSkippedRow[];
  } = {
    success,
    configured,
    source,
    summary: {
      createCount: plan.creates.length,
      updateCount: plan.updates.length,
      unchangedCount: plan.unchanged.length,
      skipCount: plan.skipped.length,
      totalRows:
        plan.creates.length + plan.updates.length + plan.unchanged.length,
    },
    courseCodes: plan.courseCodes,
    duplicateNames: plan.duplicateNames,
    creates: plan.creates.map(formatImportItem),
    updates: plan.updates.map(formatImportItem),
    unchanged: plan.unchanged.map(formatImportItem),
    skipped: plan.skipped,
  };
  if (error) result.error = error;
  return result;
}

export function buildDemoDayImportPlanForTest({
  rows,
  existingTeams,
  skipped = [],
  duplicateNames = [],
}: {
  rows: NormalizedDemoDayImportRow[];
  existingTeams: TeamForImport[];
  skipped?: ImportSkippedRow[];
  duplicateNames?: string[];
}) {
  return formatImportPreview({
    configured: true,
    source: "csv",
    plan: buildImportPlan({ rows, existingTeams, skipped, duplicateNames }),
  });
}

function emptyImportPreview({
  configured,
  source,
  error,
}: {
  configured: boolean;
  source: ImportSource;
  error: string;
}) {
  const plan = buildImportPlan({
    rows: [],
    existingTeams: [],
    skipped: [],
    duplicateNames: [],
  });
  return formatImportPreview({
    configured,
    source,
    plan,
    success: false,
    error,
  });
}

function getAirtableConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return null;
  return {
    token,
    baseId,
    assignmentsTable: process.env.AIRTABLE_ASSIGNMENTS_TABLE || "Assignments",
    projectInstancesTable:
      process.env.AIRTABLE_PROJECT_INSTANCES_TABLE || "Project Instances",
    projectsTable: process.env.AIRTABLE_PROJECTS_TABLE || "Projects",
  };
}

async function fetchAirtableTable({
  token,
  baseId,
  tableName,
  fields,
}: {
  token: string;
  baseId: string;
  tableName: string;
  fields?: string[];
}) {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
    );
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("cellFormat", "string");
    url.searchParams.set("timeZone", "UTC");
    url.searchParams.set("userLocale", "en-us");
    if (offset) url.searchParams.set("offset", offset);
    for (const field of fields || []) {
      url.searchParams.append("fields[]", field);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Airtable request failed for ${tableName}: ${response.status} ${detail.slice(0, 160)}`,
      );
    }
    const body = (await response.json()) as {
      records?: AirtableRecord[];
      offset?: string;
    };
    records.push(...(body.records || []));
    offset = body.offset;
    if (offset) {
      await new Promise((resolve) => setTimeout(resolve, 225));
    }
  } while (offset);

  return records;
}

async function loadImportRowsFromAirtable() {
  const config = getAirtableConfig();
  if (!config) {
    throw new Error("Airtable is not configured for this deployment.");
  }

  const [assignmentRecords, projectInstanceRecords, projectRecords] =
    await Promise.all([
      fetchAirtableTable({
        ...config,
        tableName: config.assignmentsTable,
        fields: [
          DEMO_DAY_IMPORT_FIELD_NAMES.assignmentSemester,
          DEMO_DAY_IMPORT_FIELD_NAMES.assignmentProjectInstance,
          DEMO_DAY_IMPORT_FIELD_NAMES.assignmentContributor,
          DEMO_DAY_IMPORT_FIELD_NAMES.assignmentCourse,
        ],
      }),
      fetchAirtableTable({
        ...config,
        tableName: config.projectInstancesTable,
      }),
      fetchAirtableTable({
        ...config,
        tableName: config.projectsTable,
      }),
    ]);

  return {
    assignments: airtableRecordsToRows(assignmentRecords),
    projectInstances: airtableRecordsToRows(projectInstanceRecords),
    projects: airtableRecordsToRows(projectRecords),
  };
}

async function getImportInput(args: {
  assignmentsCsv?: string;
  projectInstancesCsv?: string;
  projectsCsv?: string;
}): Promise<{
  configured: boolean;
  source: ImportSource;
  assignments: CsvRow[];
  projectInstances: CsvRow[];
  projects: CsvRow[];
}> {
  const hasCsv =
    !!args.assignmentsCsv || !!args.projectInstancesCsv || !!args.projectsCsv;
  if (hasCsv) {
    if (!args.assignmentsCsv || !args.projectsCsv) {
      throw new Error("Upload both Assignments.csv and Projects.csv.");
    }
    return {
      configured: !!getAirtableConfig(),
      source: "csv",
      assignments: parseCsv(args.assignmentsCsv),
      projectInstances: args.projectInstancesCsv
        ? parseCsv(args.projectInstancesCsv)
        : [],
      projects: parseCsv(args.projectsCsv),
    };
  }

  const configured = !!getAirtableConfig();
  if (!configured) {
    throw new Error(
      "Airtable is not configured. Upload Assignments.csv and Projects.csv instead.",
    );
  }
  const { assignments, projectInstances, projects } =
    await loadImportRowsFromAirtable();
  return {
    configured,
    source: "airtable",
    assignments,
    projectInstances,
    projects,
  };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getAliasedValue(row: CsvRow, aliases: string[]) {
  const aliasSet = new Set(aliases);
  for (const [header, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(header))) return value.trim();
  }
  return "";
}

export function parseBoardAssignmentCsv(text: string): {
  assignments: BoardAssignment[];
  invalidRows: Array<{
    rowNumber: number;
    projectInstance?: string;
    reason: string;
  }>;
  duplicateProjectInstances: string[];
} {
  const rows = parseCsv(text);
  const invalidRows: Array<{
    rowNumber: number;
    projectInstance?: string;
    reason: string;
  }> = [];
  const assignments: BoardAssignment[] = [];
  const duplicateProjectInstances: string[] = [];
  const seen = new Set<string>();

  if (rows.length === 0) {
    return {
      assignments,
      invalidRows: [{ rowNumber: 1, reason: "CSV has no assignment rows" }],
      duplicateProjectInstances,
    };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const projectInstance = getAliasedValue(row, [
      "projectinstance",
      "project",
      "instance",
    ]);
    const projectName = getAliasedValue(row, [
      "projectteamname",
      "projectname",
      "teamname",
      "project",
      "name",
    ]);
    const signName = getAliasedValue(row, ["signname", "sign", "displayname"]);
    const fullSignName = getAliasedValue(row, [
      "fullsignnamewithboardnumber",
      "fullsignname",
      "signlabel",
    ]);
    const courseCode = getAliasedValue(row, [
      "course",
      "coursecode",
      "classcode",
    ]);
    const courseName = getAliasedValue(row, ["coursename", "classname"]);
    const time = getAliasedValue(row, ["time", "timeslot", "boardtime"]);
    const roundRaw = getAliasedValue(row, [
      "round",
      "demodayround",
      "roundnumber",
    ]);
    const boardNumber = getAliasedValue(row, [
      "boardnumber",
      "board",
      "demodayboardnumber",
    ]);
    const round = Number.parseInt(roundRaw, 10);
    const rowErrors: string[] = [];
    const isRepeatedHeader =
      normalizeHeader(boardNumber) === "boardnumber" ||
      normalizeHeader(roundRaw) === "round" ||
      normalizeHeader(courseCode) === "course";
    const hasAnyValue = Object.values(row).some((value) => value.trim());

    if (!hasAnyValue || isRepeatedHeader) return;

    if (!projectInstance && !projectName && !signName) {
      rowErrors.push(
        "projectInstance, project/team name, or sign name is required",
      );
    }
    if (!Number.isFinite(round) || round < 1) {
      rowErrors.push("round must be a positive whole number");
    }
    if (!boardNumber) rowErrors.push("boardNumber is required");

    if (rowErrors.length > 0) {
      const invalidRow: {
        rowNumber: number;
        projectInstance?: string;
        reason: string;
      } = {
        rowNumber,
        reason: rowErrors.join("; "),
      };
      if (projectInstance) invalidRow.projectInstance = projectInstance;
      invalidRows.push(invalidRow);
      return;
    }

    const matchKey =
      projectInstance ||
      `${courseCode || ""}\u0000${projectName || signName || fullSignName}`;

    if (seen.has(matchKey)) {
      duplicateProjectInstances.push(
        projectInstance || projectName || signName,
      );
      return;
    }
    seen.add(matchKey);

    const assignment: BoardAssignment = { matchKey, round, boardNumber };
    if (projectInstance) assignment.projectInstance = projectInstance;
    if (projectName) assignment.projectName = projectName;
    if (signName) assignment.signName = signName;
    if (fullSignName) assignment.fullSignName = fullSignName;
    if (courseCode) assignment.courseCode = courseCode;
    if (courseName) assignment.courseName = courseName;
    if (time) assignment.time = time;
    assignments.push(assignment);
  });

  return {
    assignments,
    invalidRows,
    duplicateProjectInstances: uniqueSorted(duplicateProjectInstances),
  };
}

function buildBoardPlan({
  assignments,
  teams,
  invalidRows,
  duplicateProjectInstances,
  manualMatches = [],
}: {
  assignments: BoardAssignment[];
  teams: Doc<"teams">[];
  invalidRows: Array<{
    rowNumber: number;
    projectInstance?: string;
    reason: string;
  }>;
  duplicateProjectInstances: string[];
  manualMatches?: BoardManualMatch[];
}) {
  const byId = new Map<Id<"teams">, Doc<"teams">>();
  const byProjectInstance = new Map<string, Doc<"teams">>();
  const byNameCourse = new Map<string, Doc<"teams">[]>();
  const byNameOnly = new Map<string, Doc<"teams">[]>();
  const manualMatchByKey = new Map(
    manualMatches.map((match) => [match.matchKey, match.teamId]),
  );

  const addNameIndex = (team: Doc<"teams">, name?: string) => {
    const normalizedName = normalizeMatchName(name || "");
    if (!normalizedName) return;
    const courseKey = `${team.courseCode || ""}\u0000${normalizedName}`;
    byNameCourse.set(courseKey, [...(byNameCourse.get(courseKey) || []), team]);
    byNameOnly.set(normalizedName, [
      ...(byNameOnly.get(normalizedName) || []),
      team,
    ]);
  };

  for (const team of teams) {
    byId.set(team._id, team);
    if (team.demoDayProjectInstance) {
      byProjectInstance.set(team.demoDayProjectInstance, team);
    }
    addNameIndex(team, team.name);
    addNameIndex(team, team.demoDaySignName);
  }

  const matched: Array<{
    teamId: Id<"teams">;
    teamName: string;
    matchKey: string;
    projectInstance?: string;
    projectName?: string;
    signName?: string;
    fullSignName?: string;
    courseCode?: string;
    courseName?: string;
    time?: string;
    round: number;
    boardNumber: string;
    previousRound?: number;
    previousBoardNumber?: string;
  }> = [];
  const unmatched: Array<BoardAssignment & { reason: string }> = [];

  const findTeamForAssignment = (assignment: (typeof assignments)[number]) => {
    const manualTeamId = manualMatchByKey.get(assignment.matchKey);
    if (manualTeamId) {
      const team = byId.get(manualTeamId);
      if (!team) {
        return { error: "Selected team is no longer available" };
      }
      if (team.hidden) {
        return { error: "Selected team is hidden" };
      }
      return { team };
    }

    if (assignment.projectInstance) {
      const team = byProjectInstance.get(assignment.projectInstance);
      if (team) return { team };
    }

    const names = [assignment.projectName, assignment.signName].filter(
      Boolean,
    ) as string[];
    for (const name of names) {
      const normalizedName = normalizeMatchName(name);
      if (!normalizedName) continue;
      const courseMatches = byNameCourse.get(
        `${assignment.courseCode || ""}\u0000${normalizedName}`,
      );
      if (courseMatches?.length === 1) return { team: courseMatches[0] };
      if ((courseMatches?.length || 0) > 1) {
        return {
          error: `Multiple teams match ${name} in ${assignment.courseCode}`,
        };
      }

      const nameMatches = byNameOnly.get(normalizedName);
      if (nameMatches?.length === 1) return { team: nameMatches[0] };
      if ((nameMatches?.length || 0) > 1) {
        return { error: `Multiple teams match ${name}` };
      }
    }

    return { error: "No imported team matches this board row" };
  };

  for (const assignment of assignments) {
    const match = findTeamForAssignment(assignment);
    if (!match.team) {
      unmatched.push({
        ...assignment,
        reason: match.error || "No imported team matches this board row",
      });
      continue;
    }
    const team = match.team;
    const matchedRow: {
      teamId: Id<"teams">;
      teamName: string;
      matchKey: string;
      projectInstance?: string;
      projectName?: string;
      signName?: string;
      fullSignName?: string;
      courseCode?: string;
      courseName?: string;
      time?: string;
      round: number;
      boardNumber: string;
      previousRound?: number;
      previousBoardNumber?: string;
    } = {
      teamId: team._id,
      teamName: team.name,
      matchKey: assignment.matchKey,
      round: assignment.round,
      boardNumber: assignment.boardNumber,
    };
    if (assignment.projectInstance) {
      matchedRow.projectInstance = assignment.projectInstance;
    }
    if (assignment.projectName) matchedRow.projectName = assignment.projectName;
    if (assignment.signName) matchedRow.signName = assignment.signName;
    if (assignment.fullSignName) {
      matchedRow.fullSignName = assignment.fullSignName;
    }
    if (assignment.courseCode) matchedRow.courseCode = assignment.courseCode;
    if (assignment.courseName) matchedRow.courseName = assignment.courseName;
    if (assignment.time) matchedRow.time = assignment.time;
    if (team.demoDayRound !== undefined) {
      matchedRow.previousRound = team.demoDayRound;
    }
    if (team.demoDayBoardNumber !== undefined) {
      matchedRow.previousBoardNumber = team.demoDayBoardNumber;
    }
    matched.push(matchedRow);
  }

  return {
    success:
      invalidRows.length === 0 &&
      unmatched.length === 0 &&
      duplicateProjectInstances.length === 0,
    summary: {
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      invalidCount: invalidRows.length,
      duplicateCount: duplicateProjectInstances.length,
    },
    matched,
    unmatched,
    invalidRows,
    duplicateProjectInstances,
  };
}

function getBoardAssignmentTeamPatch(assignment: BoardAssignment) {
  const patch: Partial<Doc<"teams">> = {
    demoDayRound: assignment.round,
    demoDayBoardNumber: assignment.boardNumber,
  };
  if (assignment.signName) patch.demoDaySignName = assignment.signName;
  if (assignment.fullSignName) {
    patch.demoDayFullSignName = assignment.fullSignName;
  }
  if (assignment.time) patch.demoDayBoardTime = assignment.time;
  if (assignment.courseName) patch.demoDayCourseName = assignment.courseName;
  if (assignment.courseCode) patch.courseCode = assignment.courseCode;
  if (assignment.projectInstance) {
    patch.demoDayProjectInstance = assignment.projectInstance;
  }
  return patch;
}

function getTeamNameFromBoardAssignment(assignment: BoardAssignment) {
  return (
    assignment.projectName ||
    assignment.signName ||
    assignment.fullSignName ||
    assignment.projectInstance ||
    `Board ${assignment.boardNumber}`
  );
}

export function buildBoardPlanForTest({
  assignments,
  teams,
  invalidRows = [],
  duplicateProjectInstances = [],
  manualMatches = [],
}: {
  assignments: BoardAssignment[];
  teams: Doc<"teams">[];
  invalidRows?: Array<{
    rowNumber: number;
    projectInstance?: string;
    reason: string;
  }>;
  duplicateProjectInstances?: string[];
  manualMatches?: BoardManualMatch[];
}) {
  return buildBoardPlan({
    assignments,
    teams,
    invalidRows,
    duplicateProjectInstances,
    manualMatches,
  });
}

export const requireDemoDayImportAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

export const previewDemoDayImportRowsInternal = internalQuery({
  args: {
    eventId: v.id("events"),
    rows: v.array(normalizedImportRowValidator),
    skipped: v.array(importSkippedRowValidator),
    duplicateNames: v.array(v.string()),
    configured: v.boolean(),
    source: v.union(v.literal("airtable"), v.literal("csv")),
  },
  returns: importPreviewReturnValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return emptyImportPreview({
        configured: args.configured,
        source: args.source,
        error: "Event not found",
      });
    }
    if (!isDemoDayMode(event.mode)) {
      return emptyImportPreview({
        configured: args.configured,
        source: args.source,
        error: "Event is not in Demo Day mode",
      });
    }

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const plan = buildImportPlan({
      rows: args.rows,
      existingTeams,
      skipped: args.skipped,
      duplicateNames: args.duplicateNames,
    });

    return formatImportPreview({
      configured: args.configured,
      source: args.source,
      plan,
    });
  },
});

export const applyDemoDayImportRowsInternal = internalMutation({
  args: {
    eventId: v.id("events"),
    rows: v.array(normalizedImportRowValidator),
    skipped: v.array(importSkippedRowValidator),
    duplicateNames: v.array(v.string()),
    configured: v.boolean(),
    source: v.union(v.literal("airtable"), v.literal("csv")),
  },
  returns: importPreviewReturnValidator,
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return emptyImportPreview({
        configured: args.configured,
        source: args.source,
        error: "Event not found",
      });
    }
    if (!isDemoDayMode(event.mode)) {
      return emptyImportPreview({
        configured: args.configured,
        source: args.source,
        error: "Event is not in Demo Day mode",
      });
    }

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const plan = buildImportPlan({
      rows: args.rows,
      existingTeams,
      skipped: args.skipped,
      duplicateNames: args.duplicateNames,
    });

    for (const item of plan.creates) {
      await ctx.db.insert("teams", {
        eventId: args.eventId,
        description: "",
        track: "",
        submittedBy: userId,
        submittedAt: Date.now(),
        ...getTeamPatch(item.row),
      });
    }

    for (const item of plan.updates) {
      await ctx.db.patch(item.team._id, getTeamPatch(item.row));
    }

    const existingCourseCodes = event.courseCodes || [];
    const nextCourseCodes = [...existingCourseCodes];
    for (const courseCode of plan.courseCodes) {
      if (!nextCourseCodes.includes(courseCode)) {
        nextCourseCodes.push(courseCode);
      }
    }
    if (nextCourseCodes.length !== existingCourseCodes.length) {
      await ctx.db.patch(args.eventId, { courseCodes: nextCourseCodes });
    }

    return formatImportPreview({
      configured: args.configured,
      source: args.source,
      plan,
    });
  },
});

export const previewBoardAssignmentsInternal = internalQuery({
  args: {
    eventId: v.id("events"),
    assignments: v.array(boardAssignmentValidator),
    invalidRows: v.array(boardInvalidRowValidator),
    duplicateProjectInstances: v.array(v.string()),
    manualMatches: v.optional(v.array(boardManualMatchValidator)),
  },
  returns: boardPreviewReturnValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event || !isDemoDayMode(event.mode)) {
      return {
        success: false,
        summary: {
          matchedCount: 0,
          unmatchedCount: 0,
          invalidCount: args.invalidRows.length + 1,
          duplicateCount: args.duplicateProjectInstances.length,
        },
        matched: [],
        unmatched: [],
        invalidRows: [
          ...args.invalidRows,
          {
            rowNumber: 1,
            reason: !event
              ? "Event not found"
              : "Event is not in Demo Day mode",
          },
        ],
        duplicateProjectInstances: args.duplicateProjectInstances,
      };
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return buildBoardPlan({
      assignments: args.assignments,
      teams,
      invalidRows: args.invalidRows,
      duplicateProjectInstances: args.duplicateProjectInstances,
      manualMatches: args.manualMatches,
    });
  },
});

export const applyBoardAssignmentsInternal = internalMutation({
  args: {
    eventId: v.id("events"),
    assignments: v.array(boardAssignmentValidator),
    invalidRows: v.array(boardInvalidRowValidator),
    duplicateProjectInstances: v.array(v.string()),
    manualMatches: v.optional(v.array(boardManualMatchValidator)),
    createTeams: v.optional(v.array(boardCreateTeamValidator)),
  },
  returns: boardPreviewReturnValidator,
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event || !isDemoDayMode(event.mode)) {
      return {
        success: false,
        summary: {
          matchedCount: 0,
          unmatchedCount: 0,
          invalidCount: args.invalidRows.length + 1,
          duplicateCount: args.duplicateProjectInstances.length,
        },
        matched: [],
        unmatched: [],
        invalidRows: [
          ...args.invalidRows,
          {
            rowNumber: 1,
            reason: !event
              ? "Event not found"
              : "Event is not in Demo Day mode",
          },
        ],
        duplicateProjectInstances: args.duplicateProjectInstances,
      };
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    let plan = buildBoardPlan({
      assignments: args.assignments,
      teams,
      invalidRows: args.invalidRows,
      duplicateProjectInstances: args.duplicateProjectInstances,
      manualMatches: args.manualMatches,
    });

    if (
      plan.invalidRows.length > 0 ||
      plan.duplicateProjectInstances.length > 0
    ) {
      return plan;
    }

    const createKeys = new Set(
      (args.createTeams || []).map((row) => row.matchKey),
    );
    const createdTeamIds = new Map<string, Id<"teams">>();
    for (const assignment of args.assignments) {
      if (!createKeys.has(assignment.matchKey)) continue;
      if (!plan.unmatched.some((row) => row.matchKey === assignment.matchKey)) {
        continue;
      }

      const createdTeamId = await ctx.db.insert("teams", {
        eventId: args.eventId,
        name: getTeamNameFromBoardAssignment(assignment),
        description: "",
        members: [],
        projectUrl: "",
        githubUrl: "",
        devpostUrl: "",
        track: "",
        submittedBy: userId,
        submittedAt: Date.now(),
        ...getBoardAssignmentTeamPatch(assignment),
      });
      createdTeamIds.set(assignment.matchKey, createdTeamId);
    }

    if (createdTeamIds.size > 0) {
      const nextManualMatches = [
        ...(args.manualMatches || []),
        ...Array.from(createdTeamIds, ([matchKey, teamId]) => ({
          matchKey,
          teamId,
        })),
      ];
      const nextTeams = await ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect();
      plan = buildBoardPlan({
        assignments: args.assignments,
        teams: nextTeams,
        invalidRows: args.invalidRows,
        duplicateProjectInstances: args.duplicateProjectInstances,
        manualMatches: nextManualMatches,
      });
    }

    if (!plan.success) {
      return plan;
    }

    for (const match of plan.matched) {
      await ctx.db.patch(match.teamId, getBoardAssignmentTeamPatch(match));
    }

    const existingCourseCodes = event.courseCodes || [];
    const nextCourseCodes = [...existingCourseCodes];
    for (const match of plan.matched) {
      if (match.courseCode && !nextCourseCodes.includes(match.courseCode)) {
        nextCourseCodes.push(match.courseCode);
      }
    }
    if (nextCourseCodes.length !== existingCourseCodes.length) {
      await ctx.db.patch(args.eventId, { courseCodes: nextCourseCodes });
    }

    return plan;
  },
});

export const listDemoDayImportSemesters = action({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    semesters: v.array(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.demoDayImport.requireDemoDayImportAdmin, {});

    const config = getAirtableConfig();
    if (!config) {
      return {
        configured: false,
        semesters: [],
        error:
          "Set AIRTABLE_PAT and AIRTABLE_BASE_ID in Convex env to load semesters.",
      };
    }

    try {
      const records = await fetchAirtableTable({
        ...config,
        tableName: config.assignmentsTable,
        fields: [DEMO_DAY_IMPORT_FIELD_NAMES.assignmentSemester],
      });
      const semesters = uniqueSorted(
        airtableRecordsToRows(records)
          .map((row) => row[DEMO_DAY_IMPORT_FIELD_NAMES.assignmentSemester])
          .map((value) => value?.trim())
          .filter(Boolean),
      );
      return { configured: true, semesters };
    } catch (error) {
      return {
        configured: true,
        semesters: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Airtable semesters",
      };
    }
  },
});

export const previewDemoDayImport: any = action({
  args: {
    eventId: v.id("events"),
    semester: v.string(),
    assignmentsCsv: v.optional(v.string()),
    projectInstancesCsv: v.optional(v.string()),
    projectsCsv: v.optional(v.string()),
  },
  returns: importPreviewReturnValidator,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.demoDayImport.requireDemoDayImportAdmin, {});

    try {
      const input = await getImportInput(args);
      const normalized = normalizeDemoDayImportRows({
        assignments: input.assignments,
        projectInstances: input.projectInstances,
        projects: input.projects,
        semester: args.semester,
      });

      return await ctx.runQuery(
        internal.demoDayImport.previewDemoDayImportRowsInternal,
        {
          eventId: args.eventId,
          rows: normalized.rows,
          skipped: normalized.skipped,
          duplicateNames: normalized.duplicateNames,
          configured: input.configured,
          source: input.source,
        },
      );
    } catch (error) {
      return emptyImportPreview({
        configured: !!getAirtableConfig(),
        source:
          args.assignmentsCsv || args.projectInstancesCsv || args.projectsCsv
            ? "csv"
            : "airtable",
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview Demo Day import",
      });
    }
  },
});

export const applyDemoDayImport: any = action({
  args: {
    eventId: v.id("events"),
    semester: v.string(),
    assignmentsCsv: v.optional(v.string()),
    projectInstancesCsv: v.optional(v.string()),
    projectsCsv: v.optional(v.string()),
  },
  returns: importPreviewReturnValidator,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.demoDayImport.requireDemoDayImportAdmin, {});

    try {
      const input = await getImportInput(args);
      const normalized = normalizeDemoDayImportRows({
        assignments: input.assignments,
        projectInstances: input.projectInstances,
        projects: input.projects,
        semester: args.semester,
      });

      return await ctx.runMutation(
        internal.demoDayImport.applyDemoDayImportRowsInternal,
        {
          eventId: args.eventId,
          rows: normalized.rows,
          skipped: normalized.skipped,
          duplicateNames: normalized.duplicateNames,
          configured: input.configured,
          source: input.source,
        },
      );
    } catch (error) {
      return emptyImportPreview({
        configured: !!getAirtableConfig(),
        source:
          args.assignmentsCsv || args.projectInstancesCsv || args.projectsCsv
            ? "csv"
            : "airtable",
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply Demo Day import",
      });
    }
  },
});

export const previewBoardAssignmentCsv: any = action({
  args: {
    eventId: v.id("events"),
    csv: v.string(),
    manualMatches: v.optional(v.array(boardManualMatchValidator)),
  },
  returns: boardPreviewReturnValidator,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.demoDayImport.requireDemoDayImportAdmin, {});

    const parsed = parseBoardAssignmentCsv(args.csv);
    return await ctx.runQuery(
      internal.demoDayImport.previewBoardAssignmentsInternal,
      {
        eventId: args.eventId,
        assignments: parsed.assignments,
        invalidRows: parsed.invalidRows,
        duplicateProjectInstances: parsed.duplicateProjectInstances,
        manualMatches: args.manualMatches,
      },
    );
  },
});

export const applyBoardAssignmentCsv: any = action({
  args: {
    eventId: v.id("events"),
    csv: v.string(),
    manualMatches: v.optional(v.array(boardManualMatchValidator)),
    createTeams: v.optional(v.array(boardCreateTeamValidator)),
  },
  returns: boardPreviewReturnValidator,
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.demoDayImport.requireDemoDayImportAdmin, {});

    const parsed = parseBoardAssignmentCsv(args.csv);
    return await ctx.runMutation(
      internal.demoDayImport.applyBoardAssignmentsInternal,
      {
        eventId: args.eventId,
        assignments: parsed.assignments,
        invalidRows: parsed.invalidRows,
        duplicateProjectInstances: parsed.duplicateProjectInstances,
        manualMatches: args.manualMatches,
        createTeams: args.createTeams,
      },
    );
  },
});

export const updateTeamBoardAssignment = mutation({
  args: {
    teamId: v.id("teams"),
    demoDayRound: v.number(),
    demoDayBoardNumber: v.string(),
    adminSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bypassAllowed =
      !!args.adminSecret &&
      !!process.env.DEMO_DAY_IMPORT_SECRET &&
      args.adminSecret === process.env.DEMO_DAY_IMPORT_SECRET;

    if (!bypassAllowed) {
      await requireAdmin(ctx);
    }

    await ctx.db.patch(args.teamId, {
      demoDayRound: args.demoDayRound,
      demoDayBoardNumber: args.demoDayBoardNumber,
    });
    return null;
  },
});

export const updateEventCourseCodes = mutation({
  args: {
    eventId: v.id("events"),
    courseCodes: v.array(v.string()),
    adminSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bypassAllowed =
      !!args.adminSecret &&
      !!process.env.DEMO_DAY_IMPORT_SECRET &&
      args.adminSecret === process.env.DEMO_DAY_IMPORT_SECRET;

    if (!bypassAllowed) {
      await requireAdmin(ctx);
    }

    await ctx.db.patch(args.eventId, { courseCodes: args.courseCodes });
    return null;
  },
});

export const addTeamDirect = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    members: v.array(v.string()),
    courseCode: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    adminSecret: v.optional(v.string()),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const bypassAllowed =
      !!args.adminSecret &&
      !!process.env.DEMO_DAY_IMPORT_SECRET &&
      args.adminSecret === process.env.DEMO_DAY_IMPORT_SECRET;

    if (!bypassAllowed) {
      await requireAdmin(ctx);
    }

    return await ctx.db.insert("teams", {
      eventId: args.eventId,
      name: args.name,
      description: "",
      members: args.members,
      githubUrl: args.githubUrl || "",
      projectUrl: args.githubUrl || "",
      track: "",
      courseCode: args.courseCode,
      submittedAt: Date.now(),
    });
  },
});

export const renameTeam = mutation({
  args: {
    teamId: v.id("teams"),
    newName: v.string(),
    adminSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bypassAllowed =
      !!args.adminSecret &&
      !!process.env.DEMO_DAY_IMPORT_SECRET &&
      args.adminSecret === process.env.DEMO_DAY_IMPORT_SECRET;

    if (!bypassAllowed) {
      await requireAdmin(ctx);
    }

    await ctx.db.patch(args.teamId, { name: args.newName });
    return null;
  },
});

export const importDemoDayEventFromCSVs = mutation({
  args: {
    assignmentsCsv: v.string(),
    projectsCsv: v.string(),
    eventName: v.optional(v.string()),
    eventDescription: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("upcoming"), v.literal("active"), v.literal("past")),
    ),
    adminSecret: v.optional(v.string()),
  },
  returns: v.object({
    eventId: v.id("events"),
    teamsCreated: v.number(),
    teamNamesWithDuplicates: v.array(v.string()),
    skipped: v.array(
      v.object({
        projectInstance: v.string(),
        reason: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const bypassAllowed =
      !!args.adminSecret &&
      !!process.env.DEMO_DAY_IMPORT_SECRET &&
      args.adminSecret === process.env.DEMO_DAY_IMPORT_SECRET;

    const userId = bypassAllowed
      ? (((await getAuthUserId(ctx)) as any) ?? null)
      : await requireAdmin(ctx);

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
        demoDayProjectInstance: projectInstance,
        submittedBy: userId ?? undefined,
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
