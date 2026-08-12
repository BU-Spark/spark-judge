import { MutationCtx } from "../../_generated/server";

/**
 * Semester lineup seed (2026-08-12): the real upcoming DS+X / CivicHacks /
 * Code & Tell / Demo Day events. Additive and idempotent — existing events are
 * never deleted, and an event whose name already exists is skipped.
 */

const ts = (iso: string) => new Date(iso).getTime();

const HACKATHON_RUBRIC = [
  { name: "Impact/Relevance", weight: 2, optOutAllowed: false },
  { name: "Technical Complexity", weight: 1.6, optOutAllowed: true },
  { name: "Design", weight: 1.2, optOutAllowed: true },
  { name: "Presentation", weight: 0.8, optOutAllowed: false },
  { name: "Ethics", weight: 1.6, optOutAllowed: true },
  {
    name: "Problem Understanding & Research Effort",
    weight: 0.8,
    optOutAllowed: false,
  },
];

const DEMO_DAY_COURSE_CODES = [
  "DS488/688",
  "DS519",
  "DS539",
  "DS549",
  "DS594",
  "DS701",
  "XC473",
  "XC475",
];

function judgeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

type SeedEvent = {
  name: string;
  description: string;
  mode: "hackathon" | "code_and_tell" | "demo_day";
  startDate: number;
  endDate: number;
  categories: { name: string; weight: number; optOutAllowed?: boolean }[];
  tracks?: string[];
  enableCohorts?: boolean;
  judgeCode?: string;
  courseCodes?: string[];
  codeAndTellMaxBallots?: number;
};

const EVENTS: SeedEvent[] = [
  {
    name: "Code & Tell: Fall Kickoff",
    description:
      "The semester opener: builders show something they made, ranked-choice style. Short demos, honest feedback, first look at what everyone's building.",
    mode: "code_and_tell",
    startDate: ts("2026-09-24T18:00:00-04:00"),
    endDate: ts("2026-09-24T21:00:00-04:00"),
    categories: [],
    tracks: [],
    codeAndTellMaxBallots: 80,
  },
  {
    name: "DS+X 2026",
    description:
      "Data science across every discipline: 48 hours to find a real problem, wrangle real data, and ship something that matters.",
    mode: "hackathon",
    startDate: ts("2026-10-16T17:00:00-04:00"),
    endDate: ts("2026-10-18T17:00:00-04:00"),
    categories: HACKATHON_RUBRIC,
    tracks: ["Health", "Sustainability", "Civic Tech", "Open"],
    enableCohorts: true,
    judgeCode: judgeCode(),
  },
  {
    name: "Code & Tell: AI Edition",
    description:
      "An evening of AI builds: agents, evaluators, weird little tools. Show the thing, field questions, rank your favorites.",
    mode: "code_and_tell",
    startDate: ts("2026-11-12T18:00:00-05:00"),
    endDate: ts("2026-11-12T21:00:00-05:00"),
    categories: [],
    tracks: [],
    codeAndTellMaxBallots: 80,
  },
  {
    name: "Demo Day — Fall 2026",
    description:
      "End-of-semester showcase for the practicum and innovation courses. Teams demo; attendees appreciate the work that moved them.",
    mode: "demo_day",
    startDate: ts("2026-12-10T16:00:00-05:00"),
    endDate: ts("2026-12-10T19:00:00-05:00"),
    categories: [{ name: "Demo Day", weight: 1 }],
    tracks: [],
    enableCohorts: false,
    courseCodes: DEMO_DAY_COURSE_CODES,
  },
  {
    name: "CivicHacks 2027",
    description:
      "Spark! Civic Tech Hackathon: a weekend building for the public good with community partners and real civic datasets.",
    mode: "hackathon",
    startDate: ts("2027-02-26T17:00:00-05:00"),
    endDate: ts("2027-02-28T17:00:00-05:00"),
    categories: HACKATHON_RUBRIC,
    tracks: ["EduHack", "CityHack", "JusticeHack", "EcoHack"],
    enableCohorts: true,
    judgeCode: judgeCode(),
  },
  {
    name: "Demo Day — Spring 2027",
    description:
      "The spring closer: every practicum and innovation course on the floor at once. Demo, vote, celebrate the semester's work.",
    mode: "demo_day",
    startDate: ts("2027-05-06T16:00:00-04:00"),
    endDate: ts("2027-05-06T19:00:00-04:00"),
    categories: [{ name: "Demo Day", weight: 1 }],
    tracks: [],
    enableCohorts: false,
    courseCodes: DEMO_DAY_COURSE_CODES,
  },
];

export async function seedSemesterHandler(ctx: MutationCtx) {
  const existing = await ctx.db.query("events").collect();
  const existingNames = new Set(existing.map((e) => e.name));

  const created: string[] = [];
  const skipped: string[] = [];

  for (const event of EVENTS) {
    if (existingNames.has(event.name)) {
      skipped.push(event.name);
      continue;
    }
    await ctx.db.insert("events", {
      ...event,
      status: "upcoming" as const,
      resultsReleased: false,
    });
    created.push(event.name);
  }

  return {
    message: `Created ${created.length} events, skipped ${skipped.length} existing.`,
    created,
    skipped,
  };
}
