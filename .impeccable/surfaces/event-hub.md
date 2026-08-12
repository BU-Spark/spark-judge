---
version: 1
slug: "event-hub"
primary_target: "src/components/EventView.tsx"
related_targets: ["src/components/ScoringWizard.tsx", "src/components/ResultsView.tsx", "src/lib/eventModes.ts"]
---

# Event hub surface brief (hackathon mode)

<!-- impeccable:surface-brief -->

## Scope
`/event/:eventId` when mode = hackathon: the judge's workspace — event header, cohort
team queue, scoring entry, results view. Visitor mode: Operate (hours-long use).
Out of scope: demo-day and code-and-tell branches (attendee surfaces, phase 4).

## Audience & job
Registered judges under time pressure. Job: find the next team to score, score it,
see own progress; after release, read results.

## Direction
The homepage grammar walked one level deeper:
- The event renders as a **display module** (screen-dark tile, module radius): title,
  honest meta readouts (dates, status, judge seat), mode chip in mode color.
- The team queue is the **project keyboard**: one machined key per team, LED unlit
  until scored, lit house teal when done. Press a key → scoring wizard opens **for that
  team** (replaces the disconnected "continue scoring" CTA path).
- Progress is a readout line on the module ("05 OF 12 SCORED"), not a floating sticky bar.
- Filters (track / sponsor / My Queue) are engraved chips above the keyboard.
- Results (released): prize winners first, then the engraved ledger of scores.

## UX changes vs current
1. Key press enters the wizard at that team (deep-linkable: `?team=`).
2. Sticky bottom progress bar removed; progress lives on the module.
3. "Not registered" state becomes an idle panel with the judge-code action,
   not a dead-end message.

## Inventory
| Ingredient | Medium |
| ---------- | ------ |
| Display module | `EventView` header region |
| Team keyboard | `TeamSelectionSection` → key grid |
| Wizard entry | `ScoringWizard` (see scoring-wizard brief) |
| Results | `ResultsView` |

## Constraints
Keep registration gating, cohort logic, results-release gating. Keys are real links
(deep-linkable, middle-clickable). Keyboard grid collapses 4→2→1 by halving.

## Built (2026-08-12)
Hackathon branch converted: display-module header with progress readout (sticky bar
removed), project-keyboard queue with `?team=` deep links into the wizard, engraved
filter controls + My Queue chip, idle panel with judge-code action for unregistered
judges, results as prize winners + engraved ledger. Styles in `src/components/EventView.fi.css`
(`fi-ev-*`). Demo-day and code-and-tell branches untouched (phase 4).
