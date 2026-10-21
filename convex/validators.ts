import { v } from "convex/values";

// Validators shared by the schema and function arguments/returns.

export const EVENT_MODE_VALIDATOR = v.union(
  v.literal("hackathon"),
  v.literal("demo_day"),
  v.literal("code_and_tell"),
);

export const CODE_AND_TELL_PHASE_VALIDATOR = v.union(
  v.literal("submissions"),
  v.literal("presentations"),
  v.literal("voting"),
  v.literal("closed"),
);
