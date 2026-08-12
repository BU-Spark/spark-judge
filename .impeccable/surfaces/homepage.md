---
version: 1
slug: "homepage"
primary_target: "src/components/LandingPageNew.tsx"
related_targets: ["index.html","src/AppNew.tsx","src/index.css","src/lib/homepageDemo.ts","src/lib/homepagePhase.ts"]
---

# Homepage surface brief

<!-- impeccable:surface-brief -->

## Scope
`/` landing hub + shared shell tone for event-entry CTAs. Visitor mode: Operate.
Out of scope: full EventView and admin redesign.

## Audience & job
Judges first under time pressure; also admins, participants, attendees.
Job: feel semester pulse and enter the right mode-specific action.
The homepage is NOT event marketing — DS+X and CivicHacks (the only hackathon-type
events) have their own sites; Code & Tell and Demo Day are separate event formats
with their own judging, all served here.

## Direction
The Field Instrument (chosen 2026-08-11 from the direction hand; replaces the Teletext Hybrid Hub).
Teenage Engineering OP-1 grammar: light milled chassis, dark display module with the live event,
and the semester rail docked beneath it as the module's time axis — the live step is patched
to the screen by a lead (2px, mode color) swept through smooth rounded elbows across the 96px channel, terminating
in a single input jack on the module's edge. Each event mode has its own socket position and
color (Code & Tell left/blue, hackathon center/teal, Demo Day right/green); only the jack in
use is rendered — no unused jacks, no labels, no bus hardware; the channel carries no hairline.
Then project keyboard, step-sequencer upcoming, engraved-ledger event log (no tape idiom).
Modes are color-coded: hackathon teal, Code & Tell blue, Demo Day green; house teal stays
the brand thread.
No hero-metric stat bands: the event-parameters meter bay was cut 2026-08-12 as cliche AI design
repeating the event card; event facts live on the display module's meta row (The No Stat-Band
Rule, DESIGN.md). Working previews: `.impeccable/previews/field-instrument.html`
(+ `-code-and-tell` / `-demo-day` mode variants). Default route uses synthetic demo
(`/?demo=0` for live Convex).

## Memorable moment
The display module's mode-voiced canvas animation + the orange transport key naming the verb.

## Composition
Authority: `.impeccable/previews/field-instrument.html` (built world), system recorded in DESIGN.md.

## Inventory
| Ingredient | Medium |
| ---------- | ------ |
| Display module + canvas | React + canvas |
| Project keyboard | React + CSS |
| Semester rail + patch lead / sequencer / event log | React + CSS + measured SVG lead |
| Demo fixture | `src/lib/homepageDemo.ts` |
| Phase selection | `src/lib/homepagePhase.ts` |

## Build phase (2026-08-12)
Implementation phase 2, after tokens + shell. Authority for all visuals:
`.impeccable/previews/field-instrument.html` (+ `-code-and-tell` / `-demo-day` variants).
The real homepage replaces the teletext build wholesale; `?demo=0` keeps live Convex data.
Patch lead ports to a measured-SVG React component (layout effect reading live-step and
section rects; JACKS map = { code-tell: x96/#3d7bff, hackathon: x156/#1ec8b6, demo-day:
x216/#2fbf71 }).

## Constraints
Keep existing event-mode behavior when `?demo=0`. Keep auth. House teal must remain the brand anchor.
One authored motion per surface. No fake social feed. No stat bands repeating the event card.

## Unresolved
Standby module composition (lean: engraved clock + next-event line). Replay persistence after
`postDays` expiry (lean: falls to standby). Default pre-window length (~10d). Demo fixture still
uses synthetic events (TechNova etc.); consider realigning to DS+X / CivicHacks naming during
implementation.

## Semester rail — shaped 2026-08-12 (confirmed)
The rail is a phase machine, not just a timeline. Each event carries programmable `preDays` /
`postDays` windows; the display module + patch lead attach to the phase winner
(live > pre > replay):
- **live** (start→end): solid lead to the mode's socket, jack with solid mode-color core, module = live event.
- **pre** (within `preDays` of start): hollow lead/jack in the event's mode color, ARMED,
  module = event + countdown.
- **replay** (end→end+`postDays`): dimmed lead, REPLAY, module = recap/results.
- **standby** (no event in any window): no lead, quiet NOW hairline, module idles.
Time window: rolling −3 → +3 months around today. Step activation: click navigates to the event's
space; hover/focus shows a richer preview popover (name, mode chip, dates, status, counts, role).
Live events render elapsed-fill on the rule; steps within ~2% stagger/dogleg. Phase selection
extends `src/lib/homepagePhase.ts`. Steps are links; aria-current on the phase winner.
