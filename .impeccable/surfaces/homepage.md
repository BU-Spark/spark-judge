---
version: 1
slug: "homepage"
primary_target: "src/components/LandingPageNew.tsx"
related_targets: ["src/components/home/EventStage.tsx","src/components/home/event-stage.css","src/lib/homepagePhase.ts","src/lib/eventStagePreview.ts","src/AppNew.tsx","index.html"]
---

# Homepage surface brief

## Scope and mode
`/` event-entry homepage and its scoped header. Visitor mode: Operate. Downstream event, scoring, submission, and admin screens retain their current design and behavior.

## Audience and task
Judges, attendees, participants, and staff arrive at the event that matters now. They should enter its participation flow without choosing a format first. Other events remain accessible afterward.

## Approved direction
Open House / Event stage. Approved comp: `.impeccable/mocks/event-entry/event-stage.png`; its sidecar records user approval and the subsequent refinements. Seed `49927b6f`, candidate 5. User explicitly rejected white as the primary background. The whole working area changes composition and color by format: judging rows and rubric, Demo Day gallery, Code & Tell project list and voting introduction.

## Automatic selection and states
Live event first; otherwise recent recap for 48 hours; otherwise next scheduled event, with no ten-day cutoff. The user asked for a recap "for a while"; 48 hours preserves the existing duration and was stated as the starting assumption. Multiple live events expose accessible event-selection buttons. A choice expires when that event stops being live. Refresh time every 30 seconds and on window focus. The calendar and past events follow the featured experience.

Upcoming events provide exploration, live events surface participation, and recaps stop inviting scoring or voting. Results links require actual release state. Empty schedules and empty project lineups remain honest.

## Content and fidelity
Existing event data, auth, judge codes, scoring locks, project navigation, and participation pages remain authoritative. No invented assignments, progress, or scores. Geometric SVG covers are decorative, not project screenshots. Selection buttons only replace the comp's permanent mode tabs when live events overlap, per user clarification. Responsive reflow preserves project content and rubric information. Composition inventory and generated-copy caveats: `.impeccable/explorations/event-entry/brief.md`.

## Verification and remaining scope
Build and 26 targeted tests pass. Desktop and 390px phone screenshots cover all modes, overlap selection, and recap. Finish reviewer disposition: ship; all three findings resolved. Global TypeScript check retains 26 baseline errors and introduces none. No production deployment or backend writes. Preview `/?demo=1&mode=demo_day`; normal `/` uses live data. Future work would extend this visual system into event participation pages after review.
