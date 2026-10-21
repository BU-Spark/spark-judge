---
name: HackJudge
description: A shared competition platform translated from the Code & Tell homepage. Event formats retain distinct working layouts.
colors:
  paper: "#f6f7f2"
  ink: "#103c3b"
  muted: "#506260"
  line: "#ccd7d1"
  teal: "#087f78"
  mint: "#dcece3"
  workspace: "#eaf1ec"
  selected: "#d8e9e0"
  hover: "#e2ece5"
  focus-on-dark: "#a8ded0"
typography:
  body:
    fontFamily: "IBM Plex Sans, Helvetica Neue, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  display:
    fontFamily: "IBM Plex Sans, Helvetica Neue, sans-serif"
    fontSize: "clamp(36px, 5vw, 64px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
rounded:
  control: "6px"
  panel: "12px"
  workspace: "16px"
spacing:
  base: "4px"
  page-inline: "clamp(20px, 5vw, 80px)"
---

# HackJudge design contract

The shared identity comes from the Code & Tell homepage: a deep-green navigation band, paper canvas, pale-mint working panels, readable project rows, and IBM Plex Sans. Competition activity supplies the hierarchy: projects, submissions, judging, ballots, and results.

This contract supersedes the previous Open House mode fields and Field Instrument styling on translated pages. Historical exploration files under `.impeccable/` remain reference material, not a reason to restore sky, citron, orange transport buttons, hardware shadows, or alternate typefaces on those pages.

## Source and scope

- `src/styles/platform.css` owns shared palette, type, spacing, shell adapters, focus, and notification styling.
- `homepage-workspace.css` and Code & Tell `workspace.css` bind their existing tokens to the shared foundation.
- `PlatformHeader.tsx` supplies the real navigation and sign-in dialog on home, profile, event, project, and admin pages. Account actions respect the existing admin role check.
- `event-stage.css` translates event entry while retaining format-specific compositions.
- `participation.css` translates judging queues, rubric scoring and review, Demo Day browsing, and the shared ballot primitives.
- `TeamPage.tsx` and `TeamPage.fi.css` own the full project presentation.
- `admin.fi.css` supplies the initial compact admin treatment. Deeper admin layouts and dedicated submission/judge-code form refinements remain subsequent passes.

Keep the existing mode-specific behavior, access checks, event locks, quotas, draft persistence, and result-release rules. A styling change does not authorize changing competition rules or publishing results.

## Type and density

Use self-hosted IBM Plex Sans. Headings use weight 600 and slightly negative tracking; controls use 500. Body text is 16px with a 1.5–1.6 line height. Supporting text is 13–14px. Reserve larger type for event and project identity, not every section.

Project detail titles use `clamp(36px, 5vw, 64px)`. Section headings use 22px; sidebar headings use 18px. Admin event-list headings use `clamp(32px, 4vw, 44px)`. Scoring project titles use `clamp(36px, 4vw, 56px)`, becoming 36px on phones. Counters and changing numerical values use tabular figures.

Use a 4px spacing base. Most panels use 24–28px padding, controls use 12–16px, and major content groups use 28–40px separation. Admin tables use a denser version of the same hierarchy.

## Color, depth, and controls

The canvas is paper. Text and primary actions use ink. Supporting text uses muted. Working panels use workspace or mint; selection and hover use related pale greens. Teal indicates focus or active work. Semantic warnings and errors keep clear text and their existing meaning.

Use flat fills, spacing, and thin rules. Remove hardware bevels, inset display effects, orange commit treatments, and decorative shadows from translated controls. Account menus and dialogs may use a quiet elevation shadow because they float above page content.

Primary buttons use ink with paper labels. Secondary buttons use paper or transparent fills and a thin line. Controls have a 44px minimum target height; score choices are 54px. Buttons and inputs use 6px corners, panels 12px, and bounded working regions 16px. Focus uses a 3px teal outline with a 4px offset on pale areas, and pale mint on dark navigation.

Provide default, hover, focus, disabled, loading, empty, and failure states. A count, color, or animation must not imply that a save succeeded before the server confirms it.

## Shared navigation

Use `PlatformHeader`, including the same logo, account menu, role-aware Admin link, and sign-in dialog. The browser chrome matches its deep-green background on every route. Regular participants cannot access admin content through the shared navigation or by entering the admin URL.

The shared shell has one main landmark, a skip link, and consistent notification styling. Keep menus inside the viewport and wrap long account names. Dialogs retain focus management and Escape behavior.

## Event workflows

Event formats change the working composition and action, while sharing the palette, type, controls, and status language.

- **Hackathon:** a project queue leads into project context beside an editable rubric. Keep draft status, progress, review, and submission controls visible. On phones the team and guidance live in a disclosure, and the rubric stacks below the project. Review rows use the same pale panels and readable score labels.
- **Demo Day:** a searchable project gallery with course filters, appreciation actions, and an explicit event allowance. On phones the remaining allowance stays in a fixed summary; leave bottom space and respect the safe area. Decorative project art uses the platform palette and remains separate from real project descriptions.
- **Code & Tell:** a project list beside an editable ranked ballot. Its existing pale ballot board, ordering controls, mobile ballot dialog, self-voting restrictions, and server-confirmed receipt remain the reference pattern.

A full-screen scoring session may replace global navigation with compact session and action rails. Keep the body scrollable so the rubric and opt-out controls remain reachable above the footer. Respect reduced motion.

## Full project pages

Use a readable description column beside a pale team-and-links panel. Project name is the focal point. Hackathons show every effective prize entry as a wrapping pill under “Entered for,” marking automatic entries. If no prize entries exist, show the track as context. Demo Day shows its course; Code & Tell has no course or prize pill. Omit missing values. Show event context, team members, and genuine project/repository links. Preserve paragraph breaks and wrap long content. Collapse to one column below 760px.

Prizes can be opt-in or automatic for a matching track. Admins configure `prizes.entryMode` for track-linked prizes; existing prizes default to opt-in. Automatic entries are derived from the current track for every team, including imported teams, and used consistently by project pages, admin entry lists, deliberation, and winner validation. The shared `PrizeEntryPicker` presents automatic entries as checked and read-only, separate from optional multi-selection. Store optional choices separately. Loading and sponsor filtering must preserve selections. Public project metadata exposes prize names and automatic status, never submission actors or timestamps.

Appreciation counts and actions appear only for Demo Day. Other formats link back to their event workflow. Do not call Demo Day appreciation endpoints for Hackathon or Code & Tell projects. Hidden projects, missing events, and event/team mismatches show an unavailable state before loading format-specific data.

The appreciation panel displays the per-project limit and remaining event allowance. Signed-out visitors can open the shared sign-in dialog. Pending sends are disabled; failures preserve the allowance, and successful sends use server-confirmed counts.

## Review routes

These routes ship in production builds; only `/admin-results-preview` is limited to development.

- `/project-preview?mode=hackathon`, `code_and_tell`, or `demo_day` renders the real project presentation with sample data. Demo Day preview interactions are local only.
- `/participation-preview?mode=hackathon|demo_day|code_and_tell` exercises sample workflows.
- `/homepage-preview` remains the Code & Tell homepage reference.
- `/events?demo=1&mode=hackathon&phase=live` exercises sample event entry.
- `/event-card-preview`, `/code-and-tell-preview`, and `/design-preview` hold card, typography, and layout studies.
- `/vote-test` runs the Code & Tell ballot with local-only votes.

Verify desktop and 390px phone layouts, keyboard focus, long content, empty and closed states, and the affected competition interactions. Admin UI review requires an authorized admin session; never bypass the role gate for a screenshot.
