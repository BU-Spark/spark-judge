/**
 * Synthetic homepage fixture for mockup-fidelity preview. Not real product
 * claims. Dates are real millisecond timestamps arranged around a fixed
 * synthetic "now" so the phase machine, semester rail window math, and
 * countdown readouts all exercise their true code paths in demo mode.
 */
const H = 3600_000;

/** Synthetic wall clock: May 25 2025, 14:32 UTC — mid–TechNova Hackathon. */
export const HOMEPAGE_DEMO_NOW = Date.UTC(2025, 4, 25, 14, 32);

export const HOMEPAGE_DEMO = {
  synthetic: true as const,
  nowMs: HOMEPAGE_DEMO_NOW,
  focal: {
    _id: "demo-technova",
    name: "TechNova Hackathon 2025",
    status: "active" as const,
    mode: "hackathon",
    description: "48 hours. Build bold. Ship real. Solve meaningful problems and create impact.",
    startDate: HOMEPAGE_DEMO_NOW - 17 * H, // started May 24
    endDate: HOMEPAGE_DEMO_NOW + 31 * H, // closes in 31 h
    seatLabel: "Judge · Pro",
  },
  projects: [
    { id: "demo-p1", name: "Voltify", team: "Team Volt", hue: "#6366f1", glyph: "bolt" as const },
    { id: "demo-p2", name: "AgriSense", team: "GreenByte", hue: "#22c55e", glyph: "leaf" as const },
    { id: "demo-p3", name: "ShieldAI", team: "Null Pointers", hue: "#7c3aed", glyph: "shield" as const },
    { id: "demo-p4", name: "MedSync", team: "CodeCrafters", hue: "#fbbf24", glyph: "network" as const },
    { id: "demo-p5", name: "LinguaLink", team: "Lost in Translation", hue: "#ec4899", glyph: "chat" as const },
  ],
  upcoming: [
    {
      _id: "demo-ct-ai",
      name: "Code & Tell: AI Edition",
      status: "upcoming" as const,
      mode: "code_and_tell",
      startDate: Date.UTC(2025, 5, 7, 9, 0),
      endDate: Date.UTC(2025, 5, 8, 21, 0),
    },
    {
      _id: "demo-innovatex",
      name: "InnovateX Hackathon",
      status: "upcoming" as const,
      mode: "hackathon",
      startDate: Date.UTC(2025, 5, 21, 9, 0),
      endDate: Date.UTC(2025, 5, 22, 21, 0),
    },
    {
      _id: "demo-bharat",
      name: "Build for Bharat Demo Day",
      status: "upcoming" as const,
      mode: "demo_day",
      startDate: Date.UTC(2025, 6, 5, 10, 0),
      endDate: Date.UTC(2025, 6, 5, 20, 0),
    },
  ],
  past: [
    {
      _id: "demo-htn",
      name: "Hack the North 2025",
      status: "past" as const,
      mode: "hackathon",
      startDate: Date.UTC(2025, 3, 18, 9, 0),
      endDate: Date.UTC(2025, 3, 20, 21, 0),
    },
    {
      _id: "demo-ct-climate",
      name: "Code & Tell: Climate Edition",
      status: "past" as const,
      mode: "code_and_tell",
      startDate: Date.UTC(2025, 2, 1, 10, 0),
      endDate: Date.UTC(2025, 2, 1, 20, 0),
    },
  ],
};

export type HomepageDemo = typeof HOMEPAGE_DEMO;
