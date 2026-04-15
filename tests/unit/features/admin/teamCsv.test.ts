import { describe, expect, it } from "vitest";

import {
  createTeamCsvTemplate,
  parseTeamCsv,
} from "@/features/admin/panels/teamCsv";

describe("teamCsv", () => {
  it("parses hackathon CSV rows with quoted cells", () => {
    const csv = [
      "name,description,members,track,projectUrl,prizes",
      '"Code Crusaders","Builds, ships, and demos","Alice Smith; Bob Jones",AI,https://github.com/team/project,"Best Overall; Audience Choice"',
    ].join("\n");

    expect(parseTeamCsv(csv, "hackathon")).toEqual([
      {
        rowNumber: 2,
        name: "Code Crusaders",
        description: "Builds, ships, and demos",
        members: ["Alice Smith", "Bob Jones"],
        entrantEmails: [],
        track: "AI",
        courseCode: undefined,
        projectUrl: "https://github.com/team/project",
        prizeNames: ["Best Overall", "Audience Choice"],
      },
    ]);
  });

  it("parses demo day CSV rows from separate member columns", () => {
    const csv = [
      "name,description,member1,member2,courseCode",
      "Studio Stack,Campus showcase,Alice Smith,Bob Jones,DS519",
    ].join("\n");

    expect(parseTeamCsv(csv, "demo_day")).toEqual([
      {
        rowNumber: 2,
        name: "Studio Stack",
        description: "Campus showcase",
        members: ["Alice Smith", "Bob Jones"],
        entrantEmails: [],
        track: undefined,
        courseCode: "DS519",
        projectUrl: undefined,
        prizeNames: [],
      },
    ]);
  });

  it("parses Code & Tell CSV rows with entrant emails", () => {
    const csv = [
      "name,description,entrantEmails,members,projectUrl",
      '"Compiler Circus","Live coding showcase","alpha@example.com; beta@example.com","Alice; Bob",https://example.com/demo',
    ].join("\n");

    expect(parseTeamCsv(csv, "code_and_tell")).toEqual([
      {
        rowNumber: 2,
        name: "Compiler Circus",
        description: "Live coding showcase",
        members: ["Alice", "Bob"],
        entrantEmails: ["alpha@example.com", "beta@example.com"],
        track: undefined,
        courseCode: undefined,
        projectUrl: "https://example.com/demo",
        prizeNames: [],
      },
    ]);
  });

  it("rejects CSV files missing required columns", () => {
    const csv = [
      "name,members,projectUrl",
      "Code Crusaders,Alice Smith; Bob Jones,https://github.com/team/project",
    ].join("\n");

    expect(() => parseTeamCsv(csv, "hackathon")).toThrow(
      "CSV must include `name`, `members` (or `member1`, `member2`, ...), and `track` columns.",
    );
  });

  it("rejects invalid project URLs", () => {
    const csv = [
      "name,members,track,projectUrl",
      "Code Crusaders,Alice Smith; Bob Jones,AI,https://gitlab.com/team/project",
    ].join("\n");

    expect(() => parseTeamCsv(csv, "hackathon")).toThrow(
      "Row 2: project URL must start with https://github.com/",
    );
  });

  it("creates a hackathon template with prizes when requested", () => {
    expect(createTeamCsvTemplate("hackathon", true)).toContain("prizes");
  });

  it("creates a Code & Tell template with entrant emails", () => {
    const template = createTeamCsvTemplate("code_and_tell");
    expect(template).toContain("entrantEmails");
    expect(template).not.toContain("track");
    expect(template).not.toContain("members");
    expect(template).not.toContain("prizes");
  });

  it("rejects Code & Tell CSV rows without entrant emails", () => {
    const csv = [
      "name,description,entrantEmails",
      "Compiler Circus,Live coding showcase,",
    ].join("\n");

    expect(() => parseTeamCsv(csv, "code_and_tell")).toThrow(
      "Row 2: at least one entrant email is required",
    );
  });

  it("rejects invalid entrant email formats", () => {
    const csv = [
      "name,entrantEmails",
      "Compiler Circus,not-an-email",
    ].join("\n");

    expect(() => parseTeamCsv(csv, "code_and_tell")).toThrow(
      "Row 2: entrant emails must be valid email addresses",
    );
  });
});
