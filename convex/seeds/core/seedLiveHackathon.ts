import { MutationCtx } from "../../_generated/server";

/**
 * Makes DS+X 2026 a live, testable hackathon: moves its window to span the
 * current moment and seeds a full team roster across its tracks. Idempotent —
 * teams are only inserted if the event has none. Dates can be pushed back to
 * October from the admin UI once wizard testing is done.
 */

const TEAMS: {
  name: string;
  description: string;
  track: string;
  members: string[];
}[] = [
  {
    name: "GridCast",
    description:
      "Probabilistic rooftop-solar forecasting from satellite imagery and smart-meter telemetry.",
    track: "Sustainability",
    members: ["Maya Chen", "Olu Adeyemi", "Sofia Ramirez"],
  },
  {
    name: "TriageLLM",
    description:
      "ER wait-time prediction with explainable triage notes over streaming vitals.",
    track: "Health",
    members: ["Daniel Okafor", "Priya Nair"],
  },
  {
    name: "BusBuddy",
    description:
      "Real-time bus-bunching detector with a commuter-facing rerouting API for the MBTA.",
    track: "Civic Tech",
    members: ["Liam O'Connor", "Grace Liu", "Noah Fischer", "Ava Brooks"],
  },
  {
    name: "SoilSignal",
    description:
      "Low-cost LoRa soil-moisture kriging for community gardens and urban farms.",
    track: "Sustainability",
    members: ["Elena Petrova", "Marcus Hill"],
  },
  {
    name: "ClaimCheck",
    description:
      "Automated claim extraction and fact-checking over city council meeting transcripts.",
    track: "Civic Tech",
    members: ["Yuki Tanaka", "Sam Whitfield", "Ines Moreau"],
  },
  {
    name: "GlucoLens",
    description:
      "Glucose trend estimation from wearable PPG signals with on-device inference.",
    track: "Health",
    members: ["Arjun Mehta", "Chloe Dubois"],
  },
  {
    name: "ParkScore",
    description:
      "Park-access equity and heat-island analysis across Boston neighborhoods.",
    track: "Civic Tech",
    members: ["Jordan Reyes", "Fatima Al-Sayed", "Tom Becker"],
  },
  {
    name: "DoseWise",
    description:
      "Medication interaction checker with pharmacokinetic dose-timing models.",
    track: "Health",
    members: ["Hannah Kim", "Diego Fuentes", "Sarah Lindqvist", "Omar Haddad"],
  },
  {
    name: "ScrapSort",
    description:
      "Computer-vision recycling sorter that adapts to a building's actual waste stream.",
    track: "Sustainability",
    members: ["Nina Kowalski", "Ben Achebe"],
  },
  {
    name: "OpenNotebook",
    description:
      "Reproducible research notebooks with one-click dataset provenance and diffs.",
    track: "Open",
    members: ["Victor Hugo Santos", "Amara Osei", "Lily Zhang"],
  },
];

export async function seedLiveHackathonHandler(ctx: MutationCtx) {
  const now = Date.now();
  const day = 24 * 3600_000;

  const event = await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("name"), "DS+X 2026"))
    .first();

  if (!event) {
    throw new Error("DS+X 2026 not found — run seed:seedSemester first");
  }

  // Move the event window to span now so it is live and scorable.
  await ctx.db.patch(event._id, {
    startDate: now - day,
    endDate: now + day,
    status: "active",
  });

  const existingTeams = await ctx.db
    .query("teams")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .collect();

  let teamsCreated = 0;
  if (existingTeams.length === 0) {
    for (const team of TEAMS) {
      await ctx.db.insert("teams", {
        eventId: event._id,
        name: team.name,
        description: team.description,
        members: team.members,
        track: team.track,
        submittedAt: now - 2 * day,
      });
      teamsCreated++;
    }
  }

  return {
    message: `DS+X 2026 is live with ${existingTeams.length + teamsCreated} teams.`,
    eventId: event._id,
    teamsCreated,
    judgeCode: event.judgeCode ?? null,
  };
}
