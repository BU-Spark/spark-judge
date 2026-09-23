---
name: HackJudge
description: Open House for homepage and event participation; Field Instrument retained on admin, profiles, full project pages, and auth.
colors:
  evergreen: "#073e39"
  lagoon: "#076b60"
  citron: "#d7ea83"
  yellow: "#f4c75f"
  sky: "#88c9e8"
  navy: "#102f55"
  lagoon-muted: "#d0e6d2"
  yellow-muted: "#354d2e"
  sky-muted: "#254568"
  sky-panel: "#b7def0"
  gallery-caption: "#f8d689"
  sky-light: "#d6edfa"
  citron-light: "#e1edb0"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.8rem, 4.5vw, 4.8rem)"
    fontWeight: 800
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  participation-display:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "clamp(2rem, 3.5vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "clamp(1.35rem, 2vw, 1.8rem)"
    fontWeight: 700
    letterSpacing: "-0.025em"
  guide-title:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  project-title:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 750
    lineHeight: 1.2
  body:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-intro:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 400
    lineHeight: 1.6
  metadata:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  badge: "4px"
  control: "6px"
  action: "7px"
  panel: "8px"
spacing:
  compact: "0.75rem"
  standard: "1rem"
  content: "1.25rem"
  section: "1.5rem"
  wide: "2rem"
  page-inline: "clamp(1.25rem, 4vw, 4.5rem)"
components:
  button-hackathon:
    backgroundColor: "{colors.citron}"
    textColor: "{colors.lagoon}"
    rounded: "{rounded.action}"
    padding: "0.9rem 1.15rem"
  button-demo-day:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.yellow}"
    rounded: "{rounded.action}"
    padding: "0.9rem 1.15rem"
  button-code-and-tell:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sky}"
    rounded: "{rounded.action}"
    padding: "0.9rem 1.15rem"
  button-navigation:
    backgroundColor: "transparent"
    textColor: "{colors.citron}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.9rem"
  project-row-hackathon:
    backgroundColor: "{colors.citron}"
    textColor: "{colors.evergreen}"
    rounded: "{rounded.action}"
    padding: "0.85rem"
  project-row-code-and-tell:
    backgroundColor: "{colors.sky-panel}"
    textColor: "{colors.navy}"
    rounded: "{rounded.action}"
    padding: "0.85rem"
  gallery-card:
    backgroundColor: "{colors.gallery-caption}"
    textColor: "{colors.evergreen}"
    rounded: "{rounded.panel}"
  guide:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.citron}"
    rounded: "{rounded.panel}"
    padding: "1.4rem"
  participation-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sky}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1rem"
  participation-search:
    backgroundColor: "{colors.sky-panel}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
  score-choice:
    backgroundColor: "{colors.citron-light}"
    textColor: "{colors.evergreen}"
    rounded: "{rounded.control}"
  score-choice-selected:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.citron}"
    rounded: "{rounded.control}"
  ballot-board:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sky-light}"
    rounded: "{rounded.panel}"
    padding: "1.6rem"
  love-tap-budget:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.gallery-caption}"
    rounded: "{rounded.panel}"
    padding: "1.25rem"
---

# Design System: HackJudge

## Overview

**Creative North Star: "Open House"**

Open House uses broad colored fields, strong Bricolage Grotesque headings, and flat geometric project art. Evergreen navigation holds the identity steady while lagoon, yellow, and sky distinguish event formats. Project names and participation controls remain readable in busy event rooms.

The user-approved expansion covers the homepage, event entry and judging queue, rubric scoring and review, Code & Tell ranked ballots, and Demo Day appreciation browsing. It extends the same visual identity. Admin, profiles, full project pages, event configuration, and authentication retain Field Instrument. Do not change their global tokens to implement participation styling.

The implemented sources are `src/components/home/event-stage.css`, `EventStage.tsx`, `src/components/participation/participation.css`, `ParticipationChrome.tsx`, `ScoringWizard.tsx`, `code-and-tell/CodeAndTellVoteView.tsx`, and `demo-day/DemoDayBrowse.tsx`. The participation contract is `.impeccable/surfaces/participation.md`. Historical color exploration in the homepage brief does not override the current sky/navy implementation. `src/index.css` remains the Field Instrument source outside this scope.

**Key Characteristics:**

- Colored page fields with contrasting text and working panels
- One expressive sans family for headings, controls, and metadata
- Flat, lightly rounded panels and geometric SVG covers
- Distinct project-and-rubric, exhibition, and list-and-ballot layouts
- Compact phone controls with reachable scoring, ballot, and budget information
- A scoped extension that preserves Field Instrument on untouched pages

## Colors

Color fills the page. The frontmatter owns the current palette; mode assignments determine its use.

### Primary

- **Evergreen** anchors shared navigation, hackathon guidance, and Demo Day budget panels. It provides text on yellow and citron.
- **Lagoon** is the hackathon field. **Citron** supplies headings, primary actions, judging rows, the rubric panel, and the homepage calendar. **Citron light** supplies unselected score choices.

### Secondary

- **Yellow** is the Demo Day field. Evergreen supplies text and actions; **gallery caption** supplies the warmer pale project panels and budget text.
- **Sky** is the permanent Code & Tell field on both homepage and participation pages. **Navy** supplies text, primary actions, and the ballot board. **Sky panel** holds eligible project cards, and **sky light** holds ballot slots and text on navy.

### Neutral

Open House has no white primary canvas. The mode-specific muted colors carry descriptions and metadata. Dark ink and pale mode panels provide the contrast normally assigned to gray neutrals.

**The Mode Field Rule.** Use the event mode to select the page field and its contrasting text pair. Carry that pair through headings, controls, and working content.

Field Instrument retains its warm desk and chassis palette, dark displays, house-teal focus, and orange commit actions on untouched pages. The scoped participation overrides do not authorize a global token migration. Legacy lilac and cobalt art variables still occur in source; they do not define a Code & Tell palette option.

## Typography

**Display and body font:** Bricolage Grotesque, self-hosted with Helvetica Neue and sans-serif fallbacks. Weight, size, and tighter heading spacing create hierarchy without a second display family.

### Hierarchy

- **Display:** the homepage event title. On phones it uses `clamp(2.75rem, 10.5vw, 4rem)` with a 15ch maximum measure.
- **Participation display:** event participation headings. Project names in scoring use a separate fluid range, `clamp(2.5rem, 4vw, 4rem)`, and reduce to 2.25rem in the compact layout.
- **Headline and guide title:** section headings and guidance panel headings. Participation section headings use 1.65rem; the ballot heading uses 1.8rem.
- **Project title:** strong row labels. Exhibition cards use larger titles to support browsing; eligible ballot projects keep a denser heading.
- **Body and introduction:** ordinary UI copy and project descriptions. Supporting descriptions keep a readable measure, commonly 48ch to 65ch in participation views.
- **Metadata:** dates, tracks, weights, counts, and supporting labels remain in Bricolage at a quieter size.

**The Plain Label Rule.** Use readable sentence-case labels. Event metadata is information, not engraved decoration or an invented eyebrow.

Untouched Field Instrument pages retain Instrument Sans and IBM Plex Mono. Existing class names do not make those fonts or hardware labels part of Open House.

## Layout

The homepage centers within 1600px and uses fluid side padding. Its desktop grid pairs an introduction with working content; the inner list-and-guide grid stacks at 1100px, and the outer layout stacks at 720px. Its gallery stays two columns on phones. Homepage composition is not a universal participation template.

Participation content centers within 1500px with the same fluid side padding. The judging queue uses plain project rows. Scoring places project context beside a pale rubric panel within 1280px; review uses readable pale rows. At 850px the scoring grid stacks, the project module loses sticky positioning, and header/footer actions remain compact horizontal groups. Team names remain visible beside the project on desktop. On phones they move into the Team & scoring guide disclosure, which keeps members and instructions available without expanding the initial scoring view. Project name, description, and position remain outside the disclosure.

Code & Tell places a searchable project list beside a navy ballot board. The board is sticky on desktop with a 100px top offset. At 850px it follows the list in document order, becomes static, and gains a fixed bottom jump link. Leave bottom space for that link and the device safe area.

Demo Day uses an exhibition grid with three columns, two at 1100px, and one at 600px. Search and course filters sit above the grid. On phones a fixed bottom summary keeps the remaining Love Taps and per-project limit visible; the full budget panel also states the event total. Leave bottom space for the summary and safe area.

Use the frontmatter spacing steps for repeated internal gaps. Maintain the mode-specific work layouts rather than turning every mode into the same card grid.

## Elevation & Depth

Open House is flat. Color changes, spacing, and thin rules separate regions. Controls and panels have no ambient or hard offset shadows. Hover feedback uses a small brightness change, an underline, or a caption fill change; the homepage primary action moves down one pixel on press.

**The Flat Surface Rule.** Separate Open House regions with color, spacing, or thin rules. Do not add hardware bevels, inset glass, offset block shadows, or decorative gradients.

The homepage has a short clipped arrival animation and a gallery caption transition. Participation disables animation, transitions, and smooth scrolling for reduced motion. Exact motion and breakpoint values live in the sidecar. Field Instrument's remaining decorative effects are outside this system; inherited result-page decoration is not a precedent for new participation screens.

## Shapes

Use rectangles with small corner rounding. Badges, controls, actions, and panels follow the frontmatter scale. Thin rules divide criteria and supporting information. Selected projects gain a visible outline; selected score choices invert fill and text. Neither selection depends on a decorative shadow.

Circles, arcs, blocks, and diagonals belong to decorative SVG covers. Keep covers separate from names and interaction icons. Arrows and hearts use consistent inline stroke SVGs. Status marks pair their shape and fill with readable text.

## Components

### Buttons

Homepage primary actions invert the current field and foreground with a 52px minimum height. Participation actions use the same inversion with a 44px minimum height and smaller padding. Secondary actions use transparent backgrounds and a thin visible outline or a text treatment. Disabled participation buttons lower opacity and use a disabled cursor.

Keyboard focus uses a three-pixel outline with an offset of four pixels in participation and five pixels in the homepage stage. Choose the ring against the surrounding region: pale on dark boards and rails, dark on pale rubric panels and ballot slots. Never derive the ring solely from an inverted button's label color.

### Navigation

The shared sticky evergreen band carries a citron text wordmark and account controls. The hardware brand mark is hidden in Open House. Account controls retain labels, a thin pale border, and a lagoon hover fill. Authentication dialog content remains Field Instrument. Scoring uses compact evergreen session and action rails around the working view.

### Selection controls and status

Event and course selection use outlined controls with inverted selected fills and `aria-pressed`. Project selection adds a visible border; ballot membership and rank also appear as text. Status badges use a thin outline and a small radius. Preserve words for live, closed, selected, saved, and remaining states rather than encoding them only through color.

### Project rows and gallery cards

Homepage and judging rows emphasize project names with supporting context. Demo Day cards devote more room to art, then title, description, a Project details disclosure, and an appreciation action. Full project links remain available. Covers are abstract decoration and make no claim about the project's actual appearance.

### Inputs / Fields

Participation search fields have an explicit label, a pale mode panel, a thin mode rule, a control radius, and a 48px minimum height. They use the same font and focus treatment as the surrounding page. Search and course filters preserve an honest empty state when no projects match.

### Scoring rubric

The citron rubric panel groups criteria with thin rules. Score choices have a 54px minimum height, pale fill at rest, and evergreen fill with citron text when selected. Optional N/A controls use the same visible selection inversion. Project context remains separate from the editable rubric; team names remain visible on desktop, and the phone disclosure includes the team, scale, and final submission guidance. Keep draft, review, and submitted states visually explicit.

### Ranked ballot

The navy ballot board holds ordered pale slots, visible rank numbers, removal links, and explicit up/down controls alongside drag reordering. Empty positions use dashed outlines. The required count, completion state, save action, and server-confirmed saved state remain visible in the board. On phones the fixed link names the ballot and shows the selected count.

### Appreciation and budgets

Demo Day pairs the Love Tap action with project-level usage. The evergreen budget panel shows the remaining count, per-project limit, and event total. The fixed phone summary repeats the remaining count and per-project limit. Preserve disabled and feedback states when appreciation is unavailable or a limit is reached.

### Guidance and content states

Homepage guidance uses evergreen/citron for judging and navy/sky light for ballots. Loading, empty, access, and closed states use plain readable copy on the mode field or pale panel. Retain actual lifecycle and save-state distinctions. Do not invent projects, totals, or successful submissions to fill these states.

## Do's and Don'ts

### Do:

- Do keep evergreen navigation consistent across homepage and event participation.
- Do use each mode's field, foreground, muted text, and panel colors together.
- Do preserve the project-and-rubric, exhibition, and list-and-ballot layouts.
- Do keep project names, action labels, draft states, and remaining budgets readable.
- Do preserve visible keyboard focus, explicit reorder controls, and reduced-motion behavior.
- Do keep Field Instrument on admin, profiles, full project pages, and authentication until separately redesigned.

### Don't:

- Don't make white the primary Open House canvas.
- Don't reintroduce lilac or a color preview switcher as the Code & Tell direction.
- Don't import hardware chassis, engraved micro-labels, keycap shadows, or decorative sequencers into Open House.
- Don't present abstract covers as screenshots, logos, or evidence about a project.
- Don't let fixed phone controls obscure the final content or primary action.
- Don't canonize inherited results decoration or leftover hardware class names as new design rules.
