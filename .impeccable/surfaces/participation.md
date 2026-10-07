# Event participation

Mode: Operate. Scope: hackathon judging queue and score wizard, Code & Tell ranked ballot, Demo Day browsing and Love Taps.

The user approved the Open House homepage and its expansion into the actual scoring screens for all event types. On September 24, 2026, they approved replacing Code & Tell navy with the shared evergreen and adding citron action accents while retaining sky backgrounds and pale-blue cards. Inherit the approved visual system; no new identity tournament. Lagoon/citron for hackathons, yellow/evergreen for Demo Day, sky/evergreen/citron for Code & Tell. Bricolage Grotesque, broad flat colored fields, readable sentence-case controls, no hardware effects or white canvas.

- Hackathon: project context beside a 1–5 weighted rubric. Retain optional N/A, browser drafts, previous/skip/next, batch review, final submission, assignment constraints and scoring locks. Keep project descriptions and members visible while evaluating.
- Code & Tell: searchable eligible project list beside an ordered ballot. Preserve account/email gate, own-project exclusion, exact required rank count, voting limits, server confirmation, editable saved ballot, and controlled results release. Reorder through drag or explicit up/down buttons. On phones the ballot follows projects with a fixed jump link.
- Demo Day: yellow exhibition gallery, course/search filters, explicit per-project and event Love Tap budgets, project detail disclosure and deep links. Preserve live-status/auth/identity/location checks and appreciation API. On phones use a vertical project list and reachable budget summary.

Interactive previews at `/participation-preview?mode=hackathon|demo_day|code_and_tell` reuse the real presentation components with local state adapters. Label all data synthetic. No preview handler may invoke a live score, vote, or appreciation mutation. Hackathon preview browser drafts use their own storage key.

Admin, profiles, full project pages, event configuration, scoring algorithms, winner selection and auth infrastructure remain outside this expansion. Event pages share the evergreen navigation with the homepage.
