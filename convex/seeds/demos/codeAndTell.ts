import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";
import { Id } from "../../_generated/dataModel";

const day = 24 * 60 * 60 * 1000;

type TeamSpec = {
  name: string;
  description: string;
  members: string[];
  projectUrl: string;
  entrantEmails: string[];
};

// These teams are also represented in scripts/code-and-tell-sample-teams.csv
// for testing bulk import on the empty event.
export const CODE_AND_TELL_SAMPLE_TEAMS: TeamSpec[] = [
  {
    name: "TypeSafe Forms",
    description:
      "A zero-dependency library for building fully type-safe HTML forms in React. Uses discriminated unions to model field state so you never accidentally read a value before validation.",
    members: ["Alex Kim", "Jordan Lee"],
    projectUrl: "https://github.com/alexkim/typesafe-forms",
    entrantEmails: ["alex.kim@example.com", "jordan.lee@example.com"],
  },
  {
    name: "Grep.ai",
    description:
      "A VS Code extension that rewrites your ad-hoc shell greps into readable, commented ripgrep commands with AI-generated explanations. Works entirely offline via a local model.",
    members: ["Sam Rivera"],
    projectUrl: "https://github.com/samrivera/grep-ai",
    entrantEmails: ["sam.rivera@example.com"],
  },
  {
    name: "LocalStack Lens",
    description:
      "A developer tool that wraps LocalStack with a visual dashboard for inspecting S3 buckets, SQS queues, and Lambda logs side-by-side—without leaving the terminal.",
    members: ["Priya Nair", "Chris Wolfe", "Dana Park"],
    projectUrl: "https://github.com/priya-nair/localstack-lens",
    entrantEmails: [
      "priya.nair@example.com",
      "chris.wolfe@example.com",
      "dana.park@example.com",
    ],
  },
  {
    name: "Fixture Forge",
    description:
      "A CLI that introspects your Prisma schema and generates type-safe seed fixtures as TypeScript objects. Supports relations, enums, and custom scalar overrides.",
    members: ["Eli Torres"],
    projectUrl: "https://github.com/eli-torres/fixture-forge",
    entrantEmails: ["eli.torres@example.com"],
  },
  {
    name: "Observability Playground",
    description:
      "An interactive browser sandbox for learning OpenTelemetry. Drag-drop spans onto a timeline, add attributes, and watch the generated SDK code update in real time.",
    members: ["Mia Chen", "Ben Okafor"],
    projectUrl: "https://github.com/mia-chen/otel-playground",
    entrantEmails: ["mia.chen@example.com", "ben.okafor@example.com"],
  },
  {
    name: "PR Digest",
    description:
      "A GitHub Action that summarises merged pull requests into a structured weekly digest posted to Slack. Uses the GitHub API diff endpoint and a local LLM for summaries.",
    members: ["Leila Hassan"],
    projectUrl: "https://github.com/leilahassan/pr-digest",
    entrantEmails: ["leila.hassan@example.com"],
  },
  {
    name: "CSS Warden",
    description:
      "A lint rule set that flags unused CSS custom properties and undeclared variable references across your entire monorepo. Integrates with stylelint and reports in CI.",
    members: ["Omar Diaz", "Nina Kowalski"],
    projectUrl: "https://github.com/omar-diaz/css-warden",
    entrantEmails: ["omar.diaz@example.com", "nina.kowalski@example.com"],
  },
];

async function createVoterUser(
  ctx: MutationCtx,
  email: string,
  name: string
): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("users", {
    name,
    email,
    emailVerificationTime: Date.now(),
    isAnonymous: false,
  });
}

export async function seedCodeAndTellDemoHandler(ctx: MutationCtx) {
  const now = Date.now();
  const adminUserId = await ensureSeedAdminUser(ctx);

  // ── Event 1: active, teams pre-loaded, voting open ────────────────────────
  const withTeamsEventId = await ctx.db.insert("events", {
    name: "Code & Tell – Spring 2025 (Teams Loaded)",
    description:
      "Active Code & Tell session with projects already loaded and voting open. Use this to test the voter UI, admin scoring summary, and ballot flow.",
    startDate: now - 2 * day,
    endDate: now + 5 * day,
    status: "active",
    categories: [],
    resultsReleased: false,
    mode: "code_and_tell",
    codeAndTellMaxBallots: 50,
  });

  const withTeamsTeamIds: Id<"teams">[] = [];
  for (const team of CODE_AND_TELL_SAMPLE_TEAMS) {
    const teamId = await ctx.db.insert("teams", {
      eventId: withTeamsEventId,
      name: team.name,
      description: team.description,
      members: team.members,
      projectUrl: team.projectUrl,
      githubUrl: team.projectUrl,
      track: "",
      entrantEmails: team.entrantEmails,
      submittedBy: adminUserId,
      submittedAt: now - 2 * day + Math.random() * day,
    });
    withTeamsTeamIds.push(teamId);
  }

  // Seed a handful of ballots so the standings panel has something to display.
  const BALLOT_PATTERNS: number[][] = [
    [0, 1, 2, 3, 4],
    [0, 2, 1, 4, 3],
    [1, 0, 2, 3, 4],
    [0, 1, 3, 2, 4],
    [2, 0, 1, 3, 4],
    [0, 3, 1, 2, 4],
    [1, 2, 0, 3, 4],
    [0, 1, 2, 4, 3],
  ];

  let ballotsInserted = 0;
  for (let i = 0; i < BALLOT_PATTERNS.length; i++) {
    const voterEmail = `voter${i + 1}@example.com`;
    const voterId = await createVoterUser(ctx, voterEmail, `Voter ${i + 1}`);
    const rankedTeamIds = BALLOT_PATTERNS[i].map(
      (idx) => withTeamsTeamIds[idx % withTeamsTeamIds.length]
    );
    const submittedAt = now - day - Math.random() * day;
    await ctx.db.insert("rankedVotes", {
      eventId: withTeamsEventId,
      voterUserId: voterId,
      rankedTeamIds,
      submittedAt,
      updatedAt: submittedAt,
    });
    ballotsInserted++;
  }

  // ── Event 2: active, no teams — ready for bulk CSV import ─────────────────
  const emptyEventId = await ctx.db.insert("events", {
    name: "Code & Tell – Summer 2025 (No Teams Yet)",
    description:
      "Active Code & Tell session with no teams loaded. Use this to test the bulk CSV import flow. A sample CSV matching this event's format is at scripts/code-and-tell-sample-teams.csv.",
    startDate: now - day,
    endDate: now + 7 * day,
    status: "active",
    categories: [],
    resultsReleased: false,
    mode: "code_and_tell",
  });

  return {
    message: [
      `Created 2 Code & Tell events:`,
      `  1. "${CODE_AND_TELL_SAMPLE_TEAMS.length} teams loaded" event (${ballotsInserted} ballots seeded)`,
      `  2. "No teams" event — import teams via scripts/code-and-tell-sample-teams.csv`,
    ].join("\n"),
    withTeamsEventId,
    emptyEventId,
    teamsCreated: CODE_AND_TELL_SAMPLE_TEAMS.length,
    ballotsInserted,
  };
}
