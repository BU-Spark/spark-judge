import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "scan demo day appreciation integrity",
  { minutes: 2 },
  internal.demoDayIntegrity.scanActiveDemoDayEvents,
);

// Off-peak (early morning US Eastern). Each run continues itself in bounded
// batches until no eligible files remain, so a backlog clears in one pass.
crons.daily(
  "delete abandoned project logo uploads",
  { hourUTC: 8, minuteUTC: 0 },
  internal.teams.sweepAbandonedLogoUploads,
  {},
);

export default crons;
