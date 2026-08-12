---
version: 1
slug: "profile"
primary_target: "src/components/ProfilePage.tsx"
related_targets: ["src/AppNew.tsx"]
---

# Profile surface brief

<!-- impeccable:surface-brief -->

## Scope
`/profile` — the signed-in judge's home base. Visitor mode: Operate.
Out of scope: admin workspace.

## Audience & job
A judge between sessions. Job: resume active judging fast, see what's assigned,
review what's done.

## Direction
The judge's bench — same components as everywhere else, no new ones:
- Active judging = a small display module per active event: event name, mode chip,
  progress readout ("05 OF 12"), orange transport "RESUME SCORING".
- Upcoming assignments = sequencer rows (mode LED, name, dates, T-minus).
- Completed = engraved ledger (collapsible), stamped CLOSED.
- Empty state = idle panel: unlit steps + engraved "NO ASSIGNMENTS YET · BROWSE EVENTS"
  with a soft key to the homepage.
- "Not signed in" state = idle panel with the sign-in soft key (no bespoke card).

## Constraints
Keep the existing data queries and collapsible-completed behavior. This page is the
lowest-risk Field Instrument conversion: only standard components, no novel patterns.
