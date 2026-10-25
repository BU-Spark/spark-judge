import { isAutomaticPrize } from "../../../../shared/prizeEntries";
import { parseCsvTable } from "./teamCsv";

/**
 * Turns a Devpost project export into teams for a HackJudge hackathon.
 *
 * Nothing is inferred: a team's track comes from its answer to the track
 * question, and it is entered only for prizes listed in Devpost's "Opt-In
 * Prizes" column. Automatic prizes (such as Top Overall) need no entry.
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
  submissionStatus: "submitted" | "draft";
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
  /** Projects skipped by status; drafts can be included explicitly. */
  notSubmitted: Record<string, number>;
  teams: DevpostTeam[];
  problems: DevpostProblem[];
  /** Teammates' extra drafts, skipped because their team is imported. */
  leftovers: Array<{ rowNumber: number; name: string; reason: string }>;
};

/** First name, last name, email. */
type Person = [string, string, string];

/** One Devpost project, possibly spread over several export rows. */
type DevpostProject = {
  rowNumber: number;
  name: string;
  status: string;
  createdAt: string;
  devpostUrl: string;
  trackAnswer: string;
  description: string;
  links: string[];
  optIns: string[];
  people: Person[];
};

const TITLE = "Project Title";
const STATUS = "Project Status";
const SUBMISSION_URL = "Submission Url";
const CREATED_AT = "Project Created At";
const ABOUT = "About The Project";
const LINKS = '"Try it out" Links';
const OPT_IN = "Opt-In Prizes";
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

/**
 * Devpost qualifies statuses, e.g. "Submitted (Gallery/Visible)" or
 * "Submitted (Hidden)", so match on the leading word.
 */
function parseStatus(status: string): "submitted" | "draft" | null {
  const word = status.trim().toLowerCase().match(/^[a-z]+/)?.[0];
  return word === "submitted" || word === "draft" ? word : null;
}

function isUntitled(name: string) {
  return !name || squash(name) === "untitled";
}

function emailsOf(project: DevpostProject) {
  return new Set(
    project.people.map(([, , email]) => email.toLowerCase()).filter(Boolean),
  );
}

/**
 * Rows are one project when they share a title and either the same
 * creation time, the same Devpost link, or a teammate.
 */
function isSameProject(a: DevpostProject, b: DevpostProject) {
  if (squash(a.name) !== squash(b.name)) return false;
  if (a.createdAt && a.createdAt === b.createdAt) return true;
  if (a.devpostUrl && urlKey(a.devpostUrl) === urlKey(b.devpostUrl)) return true;
  const emails = emailsOf(a);
  return [...emailsOf(b)].some((email) => emails.has(email));
}

function mergeProject(into: DevpostProject, row: DevpostProject) {
  const rank = (status: string) => (parseStatus(status) === "submitted" ? 1 : 0);
  if (rank(row.status) > rank(into.status)) into.status = row.status;
  into.devpostUrl ||= row.devpostUrl;
  into.trackAnswer ||= row.trackAnswer;
  into.description ||= row.description;
  if (into.links.length === 0) into.links = row.links;
  into.optIns.push(...row.optIns.filter((optIn) => !into.optIns.includes(optIn)));
  const emails = emailsOf(into);
  const names = new Set(into.people.map(([first, last]) => squash(`${first} ${last}`)));
  for (const person of row.people) {
    const [first, last, email] = person;
    const known = email
      ? emails.has(email.toLowerCase())
      : names.has(squash(`${first} ${last}`));
    if (!known) into.people.push(person);
  }
}

/**
 * The project that already holds everyone on this draft, if one does:
 * a larger team, a submitted one, or a titled one when this draft has
 * no title.
 */
function coveringProject(project: DevpostProject, projects: DevpostProject[]) {
  const emails = emailsOf(project);
  if (emails.size === 0) return undefined;
  return projects.find((other) => {
    if (other === project) return false;
    const otherEmails = emailsOf(other);
    if (![...emails].every((email) => otherEmails.has(email))) return false;
    return (
      otherEmails.size > emails.size ||
      parseStatus(other.status) === "submitted" ||
      (isUntitled(project.name) && !isUntitled(other.name))
    );
  });
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
    includeDrafts?: boolean;
  },
): DevpostImportPlan {
  const rows = parseCsvTable(text).filter((row) =>
    row.some((cell) => cell.trim()),
  );
  const header = rows[0]?.map((cell) => cell.trim()) ?? [];
  const column = (name: string) => header.indexOf(name);
  // Accept the singular label too. Never treat a missing column as
  // empty selections: re-importing would erase existing prize entries.
  const optInColumn = column(OPT_IN) >= 0 ? column(OPT_IN) : column("Opt-In Prize");
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
  if (optInColumn < 0) {
    throw new Error(
      'The export has no "Opt-In Prizes" column. Download a new project export from Devpost so prize entries can be imported safely.',
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

  const memberStart = column(FIRST_MEMBER);
  const trackList = options.tracks.join(", ");

  // Devpost writes one row per prize opt-in, and teammates sometimes each
  // start their own draft, so first collect the rows that are one project.
  const projects: DevpostProject[] = [];
  rows.slice(1).forEach((row, index) => {
    const people: Person[] = [
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
        const person: Person = [cell(row, i), cell(row, i + 1), cell(row, i + 2)];
        if (person.some(Boolean)) people.push(person);
      }
    }
    const entry: DevpostProject = {
      rowNumber: index + 2,
      name: cell(row, column(TITLE)),
      status: cell(row, column(STATUS)) || "No status",
      createdAt: cell(row, column(CREATED_AT)),
      devpostUrl: cell(row, column(SUBMISSION_URL)),
      trackAnswer: cell(row, trackColumn),
      description: cell(row, column(ABOUT)),
      links: splitLinks(cell(row, column(LINKS))),
      optIns: cell(row, optInColumn)
        .split(/[,;\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
      people: people.filter(([first, last, email]) => first || last || email),
    };
    const same = projects.find((project) => isSameProject(project, entry));
    if (same) mergeProject(same, entry);
    else projects.push(entry);
  });

  const plan: DevpostImportPlan = {
    totalProjects: projects.length,
    notSubmitted: {},
    teams: [],
    problems: [],
    leftovers: [],
  };
  const included = projects.filter((project) => {
    const submissionStatus = parseStatus(project.status);
    if (!submissionStatus || (submissionStatus === "draft" && !options.includeDrafts)) {
      plan.notSubmitted[project.status] = (plan.notSubmitted[project.status] ?? 0) + 1;
      return false;
    }
    return true;
  });
  const seenNames = new Set<string>();

  for (const project of included) {
    const { rowNumber, name } = project;
    const submissionStatus = parseStatus(project.status) ?? "draft";
    const label = isUntitled(name) ? `Row ${rowNumber} (untitled)` : name;

    // A teammate's stray draft: everyone on it is on a fuller team.
    const home = submissionStatus === "draft" ? coveringProject(project, included) : undefined;
    if (home) {
      plan.leftovers.push({
        rowNumber,
        name: label,
        reason: `Everyone on it is already on ${isUntitled(home.name) ? "another project" : home.name}.`,
      });
      continue;
    }
    if (isUntitled(name)) {
      plan.problems.push({
        rowNumber,
        name: label,
        reason: "The project has no title on Devpost yet.",
        fix: "Ask the team to name it on Devpost, then import again.",
      });
      continue;
    }
    if (seenNames.has(squash(name))) {
      plan.problems.push({
        rowNumber,
        name,
        reason: "Another project in this export has the same title.",
        fix: "Add this one with Create Team under a distinct name.",
      });
      continue;
    }
    seenNames.add(squash(name));

    const answer = project.trackAnswer;
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
      continue;
    }

    const links = project.links;
    const githubUrl =
      links.find((link) => /^https:\/\/(www\.)?github\.com\//i.test(link)) ?? "";
    const projectUrl =
      links.find((link) => link.startsWith("https://") && link !== githubUrl) ?? "";
    const devpostUrl = project.devpostUrl;

    const prizeIds: string[] = [];
    const prizeNames: string[] = [];
    const skippedPrizes: string[] = [];
    for (const optIn of new Set(project.optIns)) {
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
      } else if (!isAutomaticPrize(prize) && !prizeIds.includes(prize._id)) {
        prizeIds.push(prize._id);
        prizeNames.push(prize.name);
      }
    }

    plan.teams.push({
      rowNumber,
      submissionStatus,
      name,
      track,
      description: project.description,
      members: project.people
        .map(([first, last]) => [first, last].filter(Boolean).join(" "))
        .filter(Boolean),
      entrantEmails: [...emailsOf(project)],
      devpostUrl: devpostUrl.startsWith("https://") ? devpostUrl : "",
      projectUrl,
      githubUrl,
      prizeIds,
      prizeNames,
      skippedPrizes,
      existingTeamId:
        existingByUrl.get(urlKey(devpostUrl)) ?? existingByName.get(squash(name)),
    });
  }

  return plan;
}
