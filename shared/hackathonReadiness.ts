/**
 * Pre-event readiness rules for hackathons. Each check says what is wrong in
 * the organizer's words and where to fix it.
 */

export type ReadinessStatus = "pass" | "warn" | "fail";
export type ReadinessFixTarget = "details" | "teams" | "prizes" | "overview";

export type ReadinessCheck = {
  id: string;
  status: ReadinessStatus;
  title: string;
  detail?: string;
  /** Short list of affected items, e.g. team names. */
  items?: string[];
  fix?: { label: string; target: ReadinessFixTarget };
};

export type ReadinessTeam = {
  _id: string;
  name: string;
  hidden?: boolean;
  track?: string;
  githubUrl?: string;
  submittedBy?: string;
};

export type HackathonReadinessInput = {
  judgeCode?: string;
  categoryCount: number;
  /** Null while prizes are still loading; the check is skipped. */
  activePrizeCount: number | null;
  teams: ReadinessTeam[];
  /** Null when the judge roster couldn't be loaded; the check is skipped. */
  judgesRegistered: number | null;
  eventStatus: "upcoming" | "active" | "past";
  startDate: number;
  endDate: number;
};

function simplifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistanceAtMostOne(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Pairs of visible team names that are identical or one character apart. */
export function findSimilarTeamNames(teams: ReadinessTeam[]): string[][] {
  const visible = teams.filter((team) => !team.hidden);
  const pairs: string[][] = [];
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = simplifyName(visible[i].name);
      const b = simplifyName(visible[j].name);
      if (a.length >= 4 && b.length >= 4 && editDistanceAtMostOne(a, b)) {
        pairs.push([visible[i].name, visible[j].name]);
      }
    }
  }
  return pairs;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function getHackathonReadiness(
  input: HackathonReadinessInput,
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const visibleTeams = input.teams.filter((team) => !team.hidden);

  checks.push(
    input.judgeCode?.trim()
      ? { id: "judge-code", status: "pass", title: "Judge code is set" }
      : {
          id: "judge-code",
          status: "fail",
          title: "Set a judge code",
          detail:
            "Without a code, anyone who signs in can register as a judge and score.",
          fix: { label: "Open judging settings", target: "details" },
        },
  );

  checks.push(
    input.categoryCount > 0
      ? {
          id: "rubric",
          status: "pass",
          title: `Rubric has ${plural(input.categoryCount, "category", "categories")}`,
        }
      : {
          id: "rubric",
          status: "fail",
          title: "Add rubric categories",
          detail: "Judges have nothing to score until the rubric exists.",
          fix: { label: "Open judging settings", target: "details" },
        },
  );

  if (input.activePrizeCount !== null) checks.push(
    input.activePrizeCount > 0
      ? {
          id: "prizes",
          status: "pass",
          title: plural(input.activePrizeCount, "active prize"),
        }
      : {
          id: "prizes",
          status: "fail",
          title: "Add at least one prize",
          detail:
            "Results can't be published without a prize, and teams choose prizes when they submit.",
          fix: { label: "Add prizes", target: "prizes" },
        },
  );

  const adminAdded = visibleTeams.filter((team) => !team.submittedBy);
  if (adminAdded.length > 0) {
    checks.push({
      id: "admin-teams",
      status: input.eventStatus === "upcoming" ? "warn" : "pass",
      title: `${plural(adminAdded.length, "team")} added by an admin`,
      detail:
        input.eventStatus === "upcoming"
          ? "If these are test or sample teams, hide them before submissions open so judges never see them."
          : "Imported or admin-created teams. Hide any that shouldn't be judged.",
      items: adminAdded.map((team) => team.name),
      fix: { label: "Review teams", target: "teams" },
    });
  }

  const similar = findSimilarTeamNames(input.teams);
  if (similar.length > 0) {
    checks.push({
      id: "duplicate-teams",
      status: "warn",
      title: plural(similar.length, "possible duplicate team"),
      detail:
        "Duplicate submissions split judges between two copies of one project. Hide the extra copy.",
      items: similar.map((pair) => pair.join(" / ")),
      fix: { label: "Review teams", target: "teams" },
    });
  }

  const missingTrack = visibleTeams.filter((team) => !team.track?.trim());
  if (missingTrack.length > 0) {
    checks.push({
      id: "tracks",
      status: "warn",
      title: `${plural(missingTrack.length, "team")} without a track`,
      detail: "Track-based prizes can't include these teams automatically.",
      items: missingTrack.map((team) => team.name),
      fix: { label: "Review teams", target: "teams" },
    });
  }

  const missingRepo = visibleTeams.filter((team) => !team.githubUrl?.trim());
  if (missingRepo.length > 0) {
    checks.push({
      id: "repos",
      status: "warn",
      title: `${plural(missingRepo.length, "team")} without a repository link`,
      items: missingRepo.map((team) => team.name),
      fix: { label: "Review teams", target: "teams" },
    });
  }

  if (input.judgesRegistered !== null) {
    const none = input.judgesRegistered === 0;
    checks.push({
      id: "judges",
      status: !none ? "pass" : input.eventStatus === "upcoming" ? "warn" : "fail",
      title: none ? "No judges registered yet" : `${plural(input.judgesRegistered, "judge")} registered`,
      detail: none
        ? input.eventStatus === "upcoming"
          ? "Judges can register any time and enter the code once the event starts."
          : "Share the event link and judge code with your judges."
        : undefined,
    });
  }

  return checks;
}

export function summarizeReadiness(checks: ReadinessCheck[]) {
  return {
    blockers: checks.filter((check) => check.status === "fail").length,
    warnings: checks.filter((check) => check.status === "warn").length,
  };
}
