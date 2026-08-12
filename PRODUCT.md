# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Expert judges scoring and evaluating projects during live events. Their flow must feel clear under time pressure.

**Also critical:**
- **Organizers / program staff (admins)** who configure events, rubrics, prizes, assignments, integrity review, and results across a semester of events. Must be usable by teammates who did not build the product—not only the original author.
- **Participants** who submit teams/projects and follow event status.
- **Attendees** who browse projects, give Demo Day appreciations (“Love Taps”), or cast Code & Tell ranked ballots.

Responsive use on desktop, laptop, and mobile is required for all of the above.

## Product Purpose

HackJudge is the shared system a program team uses to run judging and scoring for every event format during a semester—hackathons, Demo Days, and Code & Tell—without fragmenting into separate tools.

Success means teammates can operate events confidently; judges can score without friction; attendees and participants get experiences that highlight projects; and organizers can trust the admin workflows enough to hand them off beyond the builder.

## Positioning

One event and admin model across three participation formats (expert rubric scoring, Demo Day appreciations, Code & Tell ranked ballots), with fairness-oriented hackathon scoring (weighted rubrics, normalization, optional category opt-outs, deliberate result release).

The product should feel like a living platform that centers projects and event energy—not a sterile internal admin utility—while keeping the same capabilities. Homepage and primary flows should carry a light social, project-forward presence; admin remains task-complete but more intuitive.

## Operating Context

- Semester cadence of multiple events with different modes under one workspace
- Google sign-in (Convex Auth) for authenticated roles
- Judge codes / verification where configured; cohort and assignment models for hackathon judging
- Demo Day project browsing, QR deep links, appreciation budgets, integrity review, CSV/Airtable-assisted import
- Code & Tell ranked ballots with deterministic standings and owner vote restrictions
- Admin workflows for rubrics, prizes, scoring locks, winner selection, and controlled result release
- Real-time Convex-backed UI; deployed as a web app (Vite frontend; Vercel hosting in current setup)

## Capabilities and Constraints

**Confirmed capabilities (must preserve functionally):**
- Event modes: `hackathon`, `demo_day`, `code_and_tell` (missing mode treated as hackathon)
- Hackathon: weighted categories, 1–5 scoring, draft-then-batch submit, scoring locks, score dashboards, prizes/winners
- Demo Day: browse, Love Tap appreciations with budgets, QR codes, integrity signals/findings, exports
- Code & Tell: signed-in ranked ballots (up to five), standings, winner release
- Shared admin workspace for event lifecycle across modes
- Profiles and team/project submission flows as implemented

**Constraints / open facts:**
- Platform is web-only (not native iOS/Android); must work well on desktop, laptop, and mobile viewports
- Redesign may replace the current “tool-like” look and homepage structure; must not drop existing event-mode behavior
- Exact brand palette tokens live in an external Figma Brand Guide (see Brand Commitments); hex values not yet copied into-repo as a locked token file
- Undecided: formal WCAG target level; treat inclusive, usable UI as a product requirement without inventing a certification claim

## Brand Commitments

- Product name: **HackJudge**
- Brand colors: somewhat stick to the team Brand Guide — [Figma Brand Guide](https://www.figma.com/design/p6p5EYvWzk70FfSrMGMbFn/Brand-Guide?node-id=0-1&p=f). Beyond palette alignment, visual direction has substantial freedom for a redesign.
- Existing logo/mark assets in `public/` (`hackjudge-logo.svg`, `hackjudge-mark.svg`, and exploration sets under `public/logo-directions/` and `public/logo-premium-explorations/`) are available brand material; whether the redesign keeps the current mark vs evolves it is open unless later locked.
- Voice/personality direction from product owner: more dynamic and fun to look at and use; platform feel with a slight social aspect on the homepage; project-highlighting; keep mature, trustworthy judging mechanics underneath.

## Evidence on Hand

- Product overview and mode matrix: `README.md`
- MLH-oriented judging methodology / fairness documentation: `docs/MLH_Platform_Overview.md`
- Demo Day feature history: `docs/demo_day_spec_updated.md`
- Brand guide (external): Figma file linked above (not machine-readable here; use as human-authoritative color reference)
- Logos and marks: `public/hackjudge-logo.svg`, `public/hackjudge-mark.svg`
- Do **not** fabricate testimonials, customer logos, rankings, pricing, or MLH partnership claims beyond what documentation already states

## Product Principles

1. **Judges first, everyone covered** — Optimize the judging path under event pressure; still raise clarity for admin, participants, and attendees.
2. **Team-operable, not builder-only** — Intuition and discoverability matter so semester operators who did not write the code can run events safely.
3. **One workspace, three formats** — Keep a shared event model; tailor participation UX per mode without splintering tools.
4. **Projects front and center** — Surfaces should showcase work and event energy, not bury projects under admin chrome.
5. **Fairness and control stay sacred** — Rubrics, normalization, locks, integrity, and deliberate result release remain trustworthy even as the experience becomes more dynamic.
