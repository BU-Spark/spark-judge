# Event entry exploration

Branch: design/judging-exploration

## Confirmed brief
Event entry establishes the new direction. The current hardware layout does not transform enough between event types. Replace its visual world. Preserve underlying event modes, auth, judge codes, drafts, locks, and deliberate result release.

## Mechanism and scene
One event system routes people into rubric scoring, project appreciations, or ranked voting. Judges and attendees arrive on laptops and phones in busy, brightly lit event rooms. Event wayfinding and project exhibitions are shared cultural references. The entry screen must make the next task obvious and expose a way to choose another event.

Avoid both a marketing hero with generic event cards and an all-purpose dense admin dashboard. Avoid another hardware instrument.

## Grounded candidates, ordered before resolution
1. Review docket: indexed events and a case-like judging brief.
2. Code workspace: event switcher and mode-specific working panes.
3. Exhibition guide: project collection with format-specific participation stations.
4. Campus directory: clearly grouped events and role-specific entry points.
5. Open House: event wayfinding with large mode-colored regions; the work area changes from queue to gallery to ballot.
6. Conference program: session index with a participation sheet per event.
7. Listening library: collections for discovery, queue for judging, ordered playlist for ranking.

## Assignment
Impeccable seed 49927b6f assigns candidate 5. Acknowledge Open House as the assigned world; user choice remains authoritative. Restrained white and ink shell with substantial teal, blue, and yellow mode regions. Strong sans typography, flat surfaces, clear icons, no instrument chassis or miniature engraved labels.

## Challenger assessment
Assess on audience identification and product clarity only.
- Warm consumer app: familiar to walk-up attendees; large tap targets support all modes, but stacked cards risk repeating one layout. Strong alternate.
- Industrial quote grammar: maker culture familiarity; bold labeled zones can distinguish tasks, but quotation marks and hazard stripes can add reading noise. Alternate.
- Calendar pad: semester-event familiarity; dates make choosing events clear, but time as sole axis can bury the participation task. Alternate.
- Nixie counter: scores map to numbers but repeats the rejected hardware family and cannot make discovery primary. Reserve.
- ASCII live scene: coding-culture identification, weak clarity for a project list and ballot. Reserve.
- Cloud quarry: modular blocks could hold projects; weak audience identification and unclear voting actions. Reserve.

## Review boundary
Direction sketches only. No app implementation before a direction is selected and its compositional options reviewed. Synthetic examples must be labeled. All modes share account/event navigation but differ in task hierarchy and content layout.

## User revision, September 23
Open House is acceptable as a starting direction, but the white-first sketch feels boring. More color is explicitly requested, and white must not be the primary background.

## Revised world for composition review
Color strategy: full palette, substantial colored surfaces. Daylight event-room use with high-contrast labels. Hackathon owns deep lagoon teal with pale citron working rows; Demo Day owns warm yellow with teal typography and project tiles; Code & Tell owns lilac with dark cobalt text and a strongly separated ordered ballot. A compact shared navigation and event selector retain platform identity. No hardware, white canvas, decorative gradients, or generic marketing hero.

The following three comps keep this world fixed and test composition: a persistent side event index; a broad horizontal selector and task stage; a compact event lobby with three differently structured participation panels. Demonstration projects and statuses are synthetic, explicitly labeled Design preview.

## Comp interpretation notes
All generated comps contain illustrative content, not factual live event data. Build only after composition approval. Remove generated slogans and incidental embellishments. Preserve the real ballot cap of five, not the three shown in the first comp. Code & Tell must use add-to-ballot controls, never the Appreciate buttons mistakenly generated in the second comp. Do not translate rubric diagrams into invented measured progress. Real event names and IDs replace format-name placeholder events. Thumbnail art is illustrative and cannot be presented as an actual project screenshot. Use existing draft persistence and precise saved-state wording.

## Approved implementation
Event stage selected by user. Homepage automatically features the live event, otherwise a recent recap, otherwise the next scheduled event. Use existing 48-hour recap duration as an explicitly stated starting assumption. Only overlapping live events expose a featured-event selector. Calendar and older events follow the main experience. No first-arrival format chooser.

Approved comp: .impeccable/mocks/event-entry/event-stage.png, with user-authorized removal of permanent type tabs.

## Fidelity inventory
| Ingredient | Implementation | Adaptation |
| --- | --- | --- |
| Evergreen navigation and wide type | HTML/CSS, self-hosted Bricolage Grotesque | Scope homepage shell only |
| Horizontal event selector | Accessible buttons | Only shown for overlapping live events per user |
| Teal, yellow, lilac page fields | CSS semantic tokens | Automatically selected by event mode |
| Left event introduction, right task content | CSS grid | Real event title and lifecycle replace generic heading |
| Demo gallery, staggered geometric covers | HTML and exact geometric SVG | Decorative covers, never project screenshots |
| Hackathon project rows and rubric | HTML/CSS | Public projects, no invented assignments or scores |
| Code & Tell project list and cobalt panel | HTML/CSS | Entry instructions; real voting occurs in existing event flow |
| Calendar after main stage | Semantic dated list | Upcoming and previous events remain accessible |
| Motion | CSS content reveal, reduced-motion fallback | Event transition only |
