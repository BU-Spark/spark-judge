import { describe, expect, it } from "vitest";
import {
  matchTrack,
  planDevpostImport,
  type DevpostPrize,
} from "@/features/admin/panels/devpostCsv";

// Column layout of a real DS+X 2026 Devpost export (no data).
const HEADER = [
  "Opt-In Prize", "Project Title", "Submission Url", "Project Status",
  "Judging Status", "Highest Step Completed", "Project Created At",
  "Project Submitted At", "Submission Last Submitted At", "About The Project",
  '"Try it out" Links', "Video Demo Link", "Image Gallery URLs",
  "Attached File S3 Key", "Built With", "Submitter First Name",
  "Submitter Last Name", "Submitter Email", "Notes", "Lovable Opt In",
  "What Is Your Teams Track?", "Figma", "Bu Libraries",
  "Team Colleges/Universities", "Additional Team Member Count",
  "Team Member 1 First Name", "Team Member 1 Last Name", "Team Member 1 Email",
  "...",
];

const TRACKS = ["Art & Design", "Health & BioTech", "College Hack", "Open Hack"];
const PRIZES: DevpostPrize[] = [
  { _id: "top", name: "Top Overall", type: "general", entryMode: "automatic" },
  { _id: "art1", name: "Art & Design #1", type: "track", track: "Art & Design", entryMode: "opt_in" },
  { _id: "lovable", name: "Best Use of Lovable", type: "sponsor", entryMode: "opt_in" },
  { _id: "first", name: "Best First-Time Hacker", type: "general", entryMode: "opt_in" },
];

// Column name -> cell, plus `members` as extra unlabeled teammate triples.
type Row = { members?: string[][] } & Record<string, any>;

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportOf(...rows: Row[]) {
  const lines = [HEADER.map(csvCell).join(",")];
  for (const row of rows) {
    const cells = HEADER.slice(0, HEADER.indexOf("Team Member 1 First Name")).map(
      (column) => row[column] ?? "",
    );
    for (const member of row.members ?? []) cells.push(...member);
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n");
}

const submitted = (title: string, extra: Row = {}): Row => ({
  "Project Title": title,
  "Project Status": "Submitted",
  "Submission Url": `https://devpost.com/software/${title.toLowerCase().replace(/ /g, "-")}`,
  "What Is Your Teams Track?": "ArtHack",
  "Submitter First Name": "Ann",
  "Submitter Last Name": "One",
  "Submitter Email": "Ann@Example.edu",
  ...extra,
});

const plan = (text: string, existingTeams: { _id: string; name: string; devpostUrl?: string }[] = []) =>
  planDevpostImport(text, { tracks: TRACKS, prizes: PRIZES, existingTeams });

describe("Devpost track answers", () => {
  it("maps the Devpost track choices to event tracks", () => {
    expect(matchTrack("ArtHack", TRACKS)).toBe("Art & Design");
    expect(matchTrack("Health+BiotechHack", TRACKS)).toBe("Health & BioTech");
    expect(matchTrack("CollegeHack", TRACKS)).toBe("College Hack");
    expect(matchTrack("OpenHack", TRACKS)).toBe("Open Hack");
    expect(matchTrack("OpenHack", TRACKS.slice(0, 3))).toBeNull();
    expect(matchTrack("", TRACKS)).toBeNull();
  });
});

describe("planDevpostImport", () => {
  it("builds a team from a submitted project, including unlabeled extra teammates", () => {
    const result = plan(
      exportOf(
        submitted("Tide Lines", {
          "About The Project": "Line one,\nline two",
          '"Try it out" Links': "https://tidelines.app https://github.com/x/tide",
          members: [["Bob", "Two", "bob@example.edu"], ["Cy", "Three", "cy@example.edu"]],
        }),
      ),
    );
    expect(result.problems).toEqual([]);
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0]).toMatchObject({
      name: "Tide Lines",
      track: "Art & Design",
      description: "Line one,\nline two",
      members: ["Ann One", "Bob Two", "Cy Three"],
      entrantEmails: ["ann@example.edu", "bob@example.edu", "cy@example.edu"],
      projectUrl: "https://tidelines.app",
      githubUrl: "https://github.com/x/tide",
      devpostUrl: "https://devpost.com/software/tide-lines",
    });
  });

  it("only enters prizes the team opted into, and explains skipped opt-ins", () => {
    const result = plan(
      exportOf(
        submitted("Opted", {
          "Opt-In Prize": "Best Use of Lovable, Art & Design #1, Best Use of Figma",
          "Lovable Opt In": "Yes",
        }),
        submitted("Wrong Track", {
          "What Is Your Teams Track?": "CollegeHack",
          "Opt-In Prize": "Art & Design #1",
        }),
        submitted("No Opt-ins", { "Lovable Opt In": "Yes" }),
      ),
    );
    const [opted, wrongTrack, none] = result.teams;
    expect(opted.prizeIds).toEqual(["lovable", "art1"]);
    expect(opted.skippedPrizes).toEqual([`"Best Use of Figma" isn't a prize in HackJudge`]);
    expect(wrongTrack.prizeIds).toEqual([]);
    expect(wrongTrack.skippedPrizes[0]).toContain("only for the Art & Design track");
    // Custom yes/no questions are not opt-ins; nothing is inferred from them.
    expect(none.prizeIds).toEqual([]);
  });

  it("skips drafts and reports teams that can't be placed, without blocking the rest", () => {
    const result = plan(
      exportOf(
        submitted("Good"),
        { ...submitted("Draft One"), "Project Status": "Draft" },
        submitted("No Track", { "What Is Your Teams Track?": "" }),
        submitted("Odd Track", { "What Is Your Teams Track?": "MusicHack" }),
        submitted("Good"),
      ),
    );
    expect(result.totalProjects).toBe(5);
    expect(result.notSubmitted).toEqual({ Draft: 1 });
    expect(result.teams.map((team) => team.name)).toEqual(["Good"]);
    expect(result.problems.map((p) => [p.name, p.reason])).toEqual([
      ["No Track", "It didn't answer the track question on Devpost."],
      ["Odd Track", expect.stringContaining('"MusicHack" doesn\'t match')],
      ["Good", expect.stringContaining("same title")],
    ]);
  });

  it("matches teams already in HackJudge by Devpost link, then by name", () => {
    const result = plan(exportOf(submitted("Tide Lines"), submitted("Quad Finder"), submitted("New One")), [
      { _id: "t1", name: "Renamed in HackJudge", devpostUrl: "https://devpost.com/software/tide-lines/" },
      { _id: "t2", name: "quad finder" },
    ]);
    expect(result.teams.map((team) => team.existingTeamId)).toEqual(["t1", "t2", undefined]);
  });

  it("rejects files that aren't Devpost exports with a clear message", () => {
    expect(() => plan("name,track\nA,ArtHack")).toThrow("doesn't look like a Devpost project export");
    expect(() => plan('"Project Title","Project Status"\nA,Submitted')).toThrow("track question");
  });
});
