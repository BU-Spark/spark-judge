export type TeamImportMode = "hackathon" | "demo_day" | "code_and_tell";

export type ParsedTeamCsvRow = {
  rowNumber: number;
  name: string;
  description: string;
  members: string[];
  entrantEmails: string[];
  track?: string;
  courseCode?: string;
  projectUrl?: string;
  prizeNames: string[];
};

const HEADER_ALIASES = {
  name: ["name", "team", "teamname"],
  description: ["description", "summary", "details"],
  members: ["members", "teammembers", "membernames"],
  entrantEmails: ["entrantemails", "entrants", "entrantemail", "emails"],
  track: ["track", "category"],
  courseCode: ["coursecode", "course", "classcode"],
  projectUrl: [
    "projecturl",
    "githuburl",
    "github",
    "repository",
    "repositoryurl",
    "repourl",
  ],
  prizes: ["prizes", "prize", "prizenames"],
} as const;

const MEMBER_COLUMN_PATTERN = /^(member|teammember|membername)\d*$/i;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getDelimiter(value: string) {
  if (value.includes(";")) return ";";
  if (value.includes("|")) return "|";
  return ",";
}

function splitList(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return trimmed
    .split(getDelimiter(trimmed))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvTable(text: string) {
  const rows: string[][] = [];
  const source = text.replace(/^\uFEFF/, "");

  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      if (source[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unmatched quote.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  if (/[",\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

function getHeaderIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function formatMissingColumnMessage(mode: TeamImportMode) {
  if (mode === "demo_day") {
    return "CSV must include `name`, `members` (or `member1`, `member2`, ...), and `courseCode` columns.";
  }
  if (mode === "code_and_tell") {
    return "CSV must include `name` and `entrantEmails` columns.";
  }
  return "CSV must include `name`, `members` (or `member1`, `member2`, ...), and `track` columns.";
}

export function parseTeamCsv(
  text: string,
  mode: TeamImportMode,
): ParsedTeamCsvRow[] {
  const table = parseCsvTable(text);
  const nonEmptyRows = table.filter((row) => row.some((cell) => cell.trim()));

  if (nonEmptyRows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const [headerRow, ...dataRows] = nonEmptyRows;
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));

  if (normalizedHeaders.every((header) => !header)) {
    throw new Error("CSV header row is empty.");
  }

  const nameIndex = getHeaderIndex(normalizedHeaders, HEADER_ALIASES.name);
  const membersIndex = getHeaderIndex(
    normalizedHeaders,
    HEADER_ALIASES.members,
  );
  const descriptionIndex = getHeaderIndex(
    normalizedHeaders,
    HEADER_ALIASES.description,
  );
  const entrantEmailsIndex = getHeaderIndex(
    normalizedHeaders,
    HEADER_ALIASES.entrantEmails,
  );
  const trackIndex = getHeaderIndex(normalizedHeaders, HEADER_ALIASES.track);
  const courseCodeIndex = getHeaderIndex(
    normalizedHeaders,
    HEADER_ALIASES.courseCode,
  );
  const projectUrlIndex = getHeaderIndex(
    normalizedHeaders,
    HEADER_ALIASES.projectUrl,
  );
  const prizesIndex = getHeaderIndex(normalizedHeaders, HEADER_ALIASES.prizes);
  const memberColumnIndexes = normalizedHeaders.reduce<number[]>(
    (indexes, header, index) => {
      if (MEMBER_COLUMN_PATTERN.test(header)) {
        indexes.push(index);
      }
      return indexes;
    },
    [],
  );

  if (
    nameIndex === -1 ||
    (mode !== "code_and_tell" &&
      membersIndex === -1 &&
      memberColumnIndexes.length === 0) ||
    (mode === "code_and_tell" && entrantEmailsIndex === -1) ||
    (mode === "hackathon" && trackIndex === -1) ||
    (mode === "demo_day" && courseCodeIndex === -1)
  ) {
    throw new Error(formatMissingColumnMessage(mode));
  }

  const rows: ParsedTeamCsvRow[] = [];
  const errors: string[] = [];

  dataRows.forEach((rawRow, dataIndex) => {
    const rowNumber = dataIndex + 2;
    if (rawRow.every((cell) => !cell.trim())) return;

    const getValue = (index: number) =>
      index >= 0 ? (rawRow[index] || "").trim() : "";
    const members = Array.from(
      new Set([
        ...splitList(getValue(membersIndex)),
        ...memberColumnIndexes.flatMap((index) => splitList(getValue(index))),
      ]),
    );

    const row: ParsedTeamCsvRow = {
      rowNumber,
      name: getValue(nameIndex),
      description: getValue(descriptionIndex),
      members,
      entrantEmails: splitList(getValue(entrantEmailsIndex)).map((email) =>
        email.toLowerCase()
      ),
      track: getValue(trackIndex) || undefined,
      courseCode: getValue(courseCodeIndex) || undefined,
      projectUrl: getValue(projectUrlIndex) || undefined,
      prizeNames: splitList(getValue(prizesIndex)),
    };

    const rowErrors: string[] = [];
    if (!row.name) {
      rowErrors.push("team name is required");
    }
    if (mode !== "code_and_tell" && row.members.length === 0) {
      rowErrors.push("at least one member is required");
    }
    if (mode === "code_and_tell" && row.entrantEmails.length === 0) {
      rowErrors.push("at least one entrant email is required");
    }
    if (mode === "hackathon" && !row.track) {
      rowErrors.push("track is required");
    }
    if (mode === "demo_day" && !row.courseCode) {
      rowErrors.push("course code is required");
    }
    if (row.projectUrl && !row.projectUrl.startsWith("https://")) {
      rowErrors.push("project URL must start with https://");
    }
    if (
      mode === "hackathon" &&
      row.projectUrl &&
      !row.projectUrl.startsWith("https://github.com/")
    ) {
      rowErrors.push("project URL must start with https://github.com/");
    }
    if (
      mode === "code_and_tell" &&
      row.entrantEmails.some(
        (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)
      )
    ) {
      rowErrors.push("entrant emails must be valid email addresses");
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
      return;
    }

    rows.push(row);
  });

  if (rows.length === 0 && errors.length === 0) {
    throw new Error("CSV file does not contain any team rows.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return rows;
}

export function createTeamCsvTemplate(
  mode: TeamImportMode,
  includePrizes = false,
) {
  const headers =
    mode === "demo_day"
      ? ["name", "description", "members", "courseCode"]
      : mode === "code_and_tell"
        ? ["name", "description", "entrantEmails", "projectUrl"]
      : [
          "name",
          "description",
          "members",
          "track",
          "projectUrl",
          ...(includePrizes ? ["prizes"] : []),
        ];

  const sampleRow =
    mode === "demo_day"
      ? [
          "Code Crusaders",
          "AI-powered study assistant",
          "Alice Smith; Bob Johnson",
          "DS519",
        ]
      : mode === "code_and_tell"
        ? [
            "Campus Canvas",
            "Live coding walkthrough and demo",
            "alice@example.com; bob@example.com",
            "https://example.com/campus-canvas",
          ]
      : [
          "Code Crusaders",
          "AI-powered study assistant",
          "Alice Smith; Bob Johnson",
          "AI",
          "https://github.com/team/project",
          ...(includePrizes ? ["Best Overall; Audience Choice"] : []),
        ];

  return [headers, sampleRow]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}
