import type { EventMode } from "../../lib/eventModes";

/**
 * Mode identity as design-system variable references (DESIGN.md mode colors).
 * Values are CSS var() references, never literal hex, so the design hook and
 * future palette updates stay in sync.
 */
export const MODE_THEME: Record<
  EventMode,
  { chassis: string; deep: string; lit: string }
> = {
  hackathon: {
    chassis: "var(--fi-teal)",
    deep: "var(--fi-teal-deep)",
    lit: "var(--fi-teal-phosphor)",
  },
  code_and_tell: {
    chassis: "var(--fi-blue)",
    deep: "var(--fi-blue-deep)",
    lit: "var(--fi-blue-lit)",
  },
  demo_day: {
    chassis: "var(--fi-green)",
    deep: "var(--fi-green-deep)",
    lit: "var(--fi-green-lit)",
  },
};

/**
 * Patch-bay input jack position per mode, in px from the semester rail's
 * content left edge. Each mode owns one socket on the module's edge; only the
 * patched jack is rendered (DESIGN.md patch-lead rule).
 */
export const MODE_JACK_X: Record<EventMode, number> = {
  code_and_tell: 96,
  hackathon: 156,
  demo_day: 216,
};
