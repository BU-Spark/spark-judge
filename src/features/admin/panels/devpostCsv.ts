import { isAutomaticPrize } from "../../../../shared/prizeEntries";
import { parseCsvTable } from "./teamCsv";

/**
 * Turns a Devpost project export into teams for a HackJudge hackathon.
 *
 * Nothing is inferred: a team's track comes from its answer to the track
 * question, and it is entered only for prizes listed in Devpost's "Opt-In
 * Prize" column. Automatic prizes (such as Top Overall) need no entry.
 */

export type DevpostPrize = {
  _id: string;
  name: string;
  type: "general" | "track" | "sponsor" | "track_sponsor";
  track?: string;
  isActive?: boolean;
  entryMode?: "automatic" | "opt_in";
};

export type DevpostExistingTeam = {
  _id: string;
  name: string;
  devpostUrl?: string;
};

export type DevpostTeam = {
  rowNumber: number;
  name: string;
  track: string;
  description: string;
  members: string[];
  entrantEmails: string[];
  devpostUrl: string;
  projectUrl: string;
  githubUrl: string;
  prizeIds: string[];
  prizeNames: string[];
  /** Prize opt-ins that could not be entered, with the reason. */
  skippedPrizes: string[];
  /** Set when the team is already in HackJudge and would be updated. */
  existingTeamId?: string;
};

export type DevpostProblem = {
  rowNumber: number;
  name: string;
  reason: string;
  fix: string;
};

export type DevpostImportPlan = {
  totalProjects: number;
  /** Projects left out because they were not submitted, by status. */
  notSubmitted: Record<string, number>;
  teams: DevpostTeam[];
  problems: DevpostProblem[];
};

const TITLE = "Project Title";
const STATUS = "Project Status";
const SUBMISSION_URL = "Submission Url";
const ABOUT = "About The Project";
const LINKS = '"Try it out" Links';
const OPT_IN = "Opt-In Prize";
const FIRST_MEMBER = "Team Member 1 First Name";

function squash(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** "Health+BiotechHack" and "Health & BioTech" both become "healthbiotech". */
function trackKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/hack$/, "");
}

export function matchTrack(answer: string, tracks: readonly string[]) {
  const key = trackKey(answer);
  if (!key) return null;
  const exact = tracks.filter((track) => trackKey(track) === key);
  if (exact.length === 1) return exact[0];
  const partial = tracks.filter((track) => {
    const candidate = trackKey(track);
    return candidate.startsWith(key) || key.startsWith(candidate);
  });
  return partial.length === 1 ? partial[0] : null;
}

function urlKey(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\/+$/, "");
}

function splitLinks(value: string) {
  return value.split(/[\s,]+/).map((link) => link.trim()).filter(Boolean);
}

export function planDevpostImport(
  text: string,
  options: {
    tracks: readonly string[];
    prizes: readonly DevpostPrize[];
    existingTeams: readonly DevpostExistingTeam[];
  },
): DevpostImportPlan {
  const rows = parseCsvTable(text).filter((row) =>
    row.some((cell) => cell.trim()),
  );
  const header = rows[0]?.map((cell) => cell.trim()) ?? [];
  const column = (name: string) => header.indexOf(name);
  const trackColumn = header.findIndex((name) =>
    /^what is your team'?s track/i.test(name),
  );
  if (column(TITLE) < 0 || column(STATUS) < 0) {
    throw new Error(
      "This doesn't look like a Devpost project export. In Devpost, open Manage Hackathon → Projects → Export, and upload that file.",
    );
  }
  if (trackColumn < 0) {
    throw new Error(
      'The export has no "What is your team\'s track?" column, so teams can\'t be placed in tracks. Check that the track question still exists in Devpost.',
    );
  }

  const cell = (row: string[], index: number) =>
    index >= 0 && index < row.length ? row[index].trim() : "";

  const prizesByName = new Map<string, DevpostPrize>();
  for (const prize of options.prizes) prizesByName.set(squash(prize.name), prize);
  const existingByUrl = new Map<string, string>();
  const existingByName = new Map<string, string>();
  for (const team of options.existingTeams) {
    if (team.devpostUrl) existingByUrl.set(urlKey(team.devpostUrl), team._id);
    existingByName.set(squash(team.name), team._id);
  }

  const plan: DevpostImportPlan = {
    totalProjects: rows.length - 1,
    notSubmitted: {},
    teams: [],
    problems: [],
  };
  const seenNames = new Set<string>();
  const memberStart = column(FIRST_MEMBER);
  const trackList = options.tracks.join(", ");

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cell(row, column(TITLE));
    const status = cell(row, column(STATUS)) || "No status";
    if (status.toLowerCase() !== "submitted") {
      plan.notSubmitted[status] = (plan.notSubmitted[status] ?? 0) + 1;
      return;
    }
    const label = name || `Row ${rowNumber}`;
    if (!name) {
      plan.problems.push({
        rowNumber,
        name: label,
        reason: "The project has no title on Devpost.",
        fix: "Ask the team to add a title on Devpost, then import again.",
      });
      return;
    }
    if (seenNames.has(squash(name))) {
      plan.problems.push({
        rowNumber,
        name,
        reason: "Another submitted project in this export has the same title.",
        fix: "Add this one with Create Team under a distinct name.",
      });
      return;
    }
    seenNames.add(squash(name));

    const answer = cell(row, trackColumn);
    const track = matchTrack(answer, options.tracks);
    if (!track) {
      plan.problems.push({
        rowNumber,
        name,
        reason: answer
          ? `Its track answer "${answer}" doesn't match a track in this event (${trackList}).`
          : "It didn't answer the track question on Devpost.",
        fix: answer
          ? "Add the track in Settings → Event Tracks, or add this team with Create Team."
          : "Ask the team to pick a track on Devpost and import again, or add them with Create Team.",
      });
      return;
    }

    const people: Array<[string, string, string]> = [
      [
        cell(row, column("Submitter First Name")),
        cell(row, column("Submitter Last Name")),
        cell(row, column("Submitter Email")),
      ],
    ];
    if (memberStart >= 0) {
      // Devpost labels only the first teammate's columns; later teammates
      // follow as unlabeled first name / last name / email triples.
      for (let i = memberStart; i < row.length; i += 3) {
        const person: [string, string, string] = [
          cell(row, i),
          cell(row, i + 1),
          cell(row, i + 2),
        ];
        if (person.some(Boolean)) people.push(person);
      }
    }

    const links = splitLinks(cell(row, column(LINKS)));
    const githubUrl =
      links.find((link) => /^https:\/\/(www\.)?github\.com\//i.test(link)) ?? "";
    const projectUrl =
      links.find((link) => link.startsWith("https://") && link !== githubUrl) ?? "";
    const devpostUrl = cell(row, column(SUBMISSION_URL));

    const prizeIds: string[] = [];
    const prizeNames: string[] = [];
    const skippedPrizes: string[] = [];
    const optIns = cell(row, column(OPT_IN))
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    for (const optIn of new Set(optIns)) {
      const prize = prizesByName.get(squash(optIn));
      if (!prize) {
        skippedPrizes.push(`"${optIn}" isn't a prize in HackJudge`);
      } else if (prize.isActive === false) {
        skippedPrizes.push(`"${prize.name}" is turned off in HackJudge`);
      } else if (
        (prize.type === "track" || prize.type === "track_sponsor") &&
        prize.track &&
        prize.track !== track
      ) {
        skippedPrizes.push(
          `"${prize.name}" is only for the ${prize.track} track, and this team is in ${track}`,
        );
      } else if (!isAutomaticPrize(prize)) {
        prizeIds.push(prize._id);
        prizeNames.push(prize.name);
      }
    }

    plan.teams.push({
      rowNumber,
      name,
      track,
      description: cell(row, column(ABOUT)),
      members: people
        .map(([first, last]) => [first, last].filter(Boolean).join(" "))
        .filter(Boolean),
      entrantEmails: [...new Set(people.map(([, , email]) => email.toLowerCase()).filter(Boolean))],
      devpostUrl: devpostUrl.startsWith("https://") ? devpostUrl : "",
      projectUrl,
      githubUrl,
      prizeIds,
      prizeNames,
      skippedPrizes,
      existingTeamId:
        existingByUrl.get(urlKey(devpostUrl)) ?? existingByName.get(squash(name)),
    });
  });

  return plan;
}
