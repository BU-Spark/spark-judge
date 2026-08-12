---
version: 1
slug: "scoring-wizard"
primary_target: "src/components/ScoringWizard.tsx"
related_targets: ["src/components/EventView.tsx"]
---

# Scoring wizard surface brief

<!-- impeccable:surface-brief -->

## Scope
The fullscreen per-team scoring flow (rubric criteria, 1–5 + opt-out, skip, draft,
review accordion, batch submit). Visitor mode: Operate — the deepest work surface
in the product.

## Audience & job
A judge mid-event scoring many teams in one sitting. Job: score fast, accurately,
without losing work; review once; submit confidently.

## Direction
The performance face of the instrument:
- Team being scored = dark display module (name, team, track chips).
- Each rubric criterion = a row of five **machined score keys** with real key travel
  (scores are inputs; inputs get keys — the system's core rule).
- Criteria progress = a bank of step LEDs across the module's edge.
- Opt-out = an honestly labeled soft key, never a hidden link.
- Review = the **take sheet**: an engraved ledger of your scores, one row per criterion.
- Batch submit = orange transport key. Skip = soft key.
- Draft persistence surfaced as a readout: "DRAFT · SAVED 14:02".

## UX changes vs current
1. Keyboard shortcuts 1–5 (and 0/esc for opt-out) per focused criterion — a judge
   scoring 12 teams should never touch the mouse.
2. Draft state made visible (currently silent localStorage).
3. Review accordion → flat ledger; one scan, no expanding.

## Constraints
Keep the draft/restore logic, batch submit mutation, and opt-out semantics.
Every key must remain focusable and operable without keyboard shortcuts.

## Built (2026-08-12)
Converted: dark team display module with criterion step LEDs, machined 1–5 score keys
(3px travel, aria-pressed), soft-key opt-out, flat take-sheet ledger (DONE/SKIPPED/OPEN
stamps, no accordion), orange SUBMIT SCORES transport, visible "DRAFT · SAVED HH:MM"
readout, keyboard shortcuts 1–5 / 0 / Esc / ↑↓. New optional prop `initialTeamId`
opens the wizard at a team (stored draft's currentIndex wins when a draft exists).
Styles in `src/components/ScoringWizard.fi.css` (`fi-wiz-*`).
