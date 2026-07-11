import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "scan demo day appreciation integrity",
  { minutes: 2 },
  internal.demoDayIntegrity.scanActiveDemoDayEvents,
);

export default crons;
