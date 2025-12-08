/**
 * Default course codes for Demo Day events.
 * These are pre-populated when creating a Demo Day event.
 * Admins can add additional courses in the event creation modal.
 */
export const DEFAULT_DEMO_DAY_COURSES = [
  "DS519",
  "DS539",
  "DS594",
  "DS549",
  "DS488/688",
  "DS701",
  "XC473",
] as const;

export type DemoDayCourse = (typeof DEFAULT_DEMO_DAY_COURSES)[number];

