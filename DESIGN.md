---
name: HackJudge
description: Open House for homepage event entry; Field Instrument retained on downstream pages.
colors:
  evergreen: "#073e39"
  lagoon: "#076b60"
  citron: "#d7ea83"
  yellow: "#f4c75f"
  lilac: "#cdc6f0"
  cobalt: "#254edb"
  blue-ink: "#163593"
  lagoon-muted: "#d0e6d2"
  yellow-muted: "#354d2e"
  lilac-muted: "#344075"
  lilac-panel: "#e1dbf7"
  gallery-caption: "#f8d689"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.8rem, 4.5vw, 4.8rem)"
    fontWeight: 800
    lineHeight: 0.99
    letterSpacing: "-0.035em"
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
    backgroundColor: "{colors.blue-ink}"
    textColor: "{colors.lilac}"
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
    backgroundColor: "{colors.lilac-panel}"
    textColor: "{colors.blue-ink}"
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
---

# Design System: HackJudge

## Overview

**Creative North Star: "Open House"**

Open House uses large colored regions, broad Bricolage Grotesque headings, and flat geometric project art. The shared evergreen navigation holds the identity steady while lagoon, yellow, and lilac distinguish the event formats. Project names and participation controls stay readable in busy, brightly lit event rooms.

This is the approved authority for the homepage and event entry only. The frontmatter tokens describe that scope. Event details, scoring, project pages, profiles, admin, and the shared sign-in dialog retain Field Instrument until separately redesigned. Homepage rules must not be applied globally through the Field Instrument tokens. The homepage shell is scoped to the root route in `src/AppNew.tsx`.

The built sources are `src/components/home/event-stage.css` and `EventStage.tsx`. `src/index.css` remains the canonical Field Instrument token source. Homepage lifecycle, event selection, and content ordering belong in `.impeccable/surfaces/homepage.md`, not in this visual system.

**Key Characteristics:**
- Colored page fields with contrasting text and working panels
- One expressive sans family for headings, controls, and metadata
- Flat, lightly rounded panels and geometric SVG covers
- Mode-specific content layouts within shared navigation
- An explicit boundary between homepage and downstream styling

## Colors

Color occupies the page, not just its accents. The frontmatter values are the homepage palette; mode assignments below define their use.

### Primary

- **Evergreen** anchors navigation, the footer, judging guidance, and text on yellow or citron.
- **Lagoon** is the hackathon page field. **Citron** supplies its heading, primary action, and project rows, and the shared calendar region.

### Secondary

- **Yellow** is the Demo Day field; evergreen supplies text and actions. Gallery captions use the lighter gallery-caption tone.
- **Lilac** is the Code & Tell field; blue-ink supplies readable text and primary actions. Lilac-panel holds the project rows.

### Tertiary

- **Cobalt** separates the ballot guidance panel and appears in geometric cover art. Use blue-ink, rather than cobalt, for ordinary text on lilac.

### Neutral

The homepage has no white neutral canvas. Mode-tinted muted colors carry descriptions and metadata. Evergreen and the pale mode colors provide the dark/light structure normally assigned to neutral gray.

**The Mode Field Rule.** Use the event mode to select the page field and its contrasting text pair. Carry that pair through the heading, primary action, and working content.

### Retained Field Instrument scope

Downstream pages retain the warm desk, chassis, and panel palette; dark display modules; key-white controls; house-teal focus; and orange commit actions defined by the `--fi-*` tokens. Their existing mode accents remain teal for hackathons, blue for Code & Tell, and green for Demo Day. Open House's yellow Demo Day and lilac voting fields do not replace those tokens.

## Typography

**Display and body font:** Bricolage Grotesque, self-hosted with Helvetica Neue and sans-serif fallbacks. Strong, tightly spaced headings sit above plain sentence-case controls and metadata. The font's width and weight provide hierarchy without a second decorative family.

### Hierarchy

- **Display:** the large event title; the frontmatter defines desktop sizing. On narrow screens it uses `clamp(2.75rem, 10.5vw, 4rem)` and a 15ch maximum measure.
- **Headline:** project-area headings with balanced wrapping.
- **Guide title:** compact headings inside contrasting guidance panels.
- **Project title:** strong row labels. Gallery titles are slightly larger at 1.25rem and reduce to 1.05rem for compact cards.
- **Body:** ordinary UI text. Introductory copy has a relaxed line height and a 35ch measure on desktop, widening to 50ch on mobile.
- **Metadata:** dates, tracks, and counts remain in the same family at a quieter size.

**The Plain Label Rule.** Use readable sentence-case labels. Event metadata is information, not an engraved decoration or an invented eyebrow.

Field Instrument retains Instrument Sans for UI and IBM Plex Mono for existing data and control labels. That pairing is a maintenance boundary, not the type choice for new homepage work. Do not extend its tiny engraved labels to new content.

## Layout

The homepage is full-width color with shared fluid side padding. Its navigation and main stage center within a 1600px maximum width. The roomy desktop grid pairs a narrower introduction with a wider participation area, using a fluid gap. Working rows and guidance can form a second grid; gallery cards form two columns.

At 1100px, the inner working grid stacks and the outer columns tighten. At 720px, the introduction and participation content stack, the navigation height reduces, and calendar content becomes one column. The gallery remains two columns and normalizes its compact lower cards to vertical cards. Long event and project names wrap rather than forcing horizontal overflow.

Use the spacing steps in frontmatter for repeated internal gaps. Larger section spacing comes from the composition, not a universal page template. The desktop column ratio and gallery ordering are homepage patterns, not requirements for future screens.

Downstream Field Instrument pages retain their current chassis containers, compact spacing, panels, and route-specific grids. Their layout is not migrated by this document.

## Elevation & Depth

Open House is flat. Large color changes, contrasting guidance panels, and thin rules separate regions. Homepage controls and panels have no ambient or hard offset shadows. The primary action moves down one pixel on press; hover feedback uses a small brightness change, an underline, or a caption fill change.

**The Flat Surface Rule.** Separate homepage regions with color, spacing, or thin rules. Do not add hardware bevels, inset glass, offset block shadows, or decorative gradients.

The stage has a short clipped reveal, and gallery captions transition their background. Both disable their animation or transition for reduced motion. Exact motion values live in the sidecar.

Field Instrument's existing inset display and mechanical control treatments remain confined to downstream components. They are not Open House elevation tokens.

## Shapes

Use simple rectangles with small, consistent corner rounding: controls, actions/rows, and panels follow the frontmatter scale. Thin rules group metadata and dated rows. Circles and large curves are native to the flat SVG cover art, while small circular or square marks describe event status. There is no blanket prohibition on circles.

Geometric covers crop cleanly into their image area. They are decorative compositions of circles, arcs, blocks, and diagonals using the shared palette. Keep them separate from text and interaction icons. Directional arrows are consistent inline SVG strokes.

Field Instrument keeps its established machined panel, key, and module radii. Do not replace these globally to match the homepage.

## Components

### Buttons

Primary actions invert the current page foreground and background, with a minimum height of 52px. Their label is bold, sentence case, and paired with a stroke arrow. Hover slightly brightens the fill; press moves down one pixel. Secondary text actions keep the page colors, a minimum 44px height, and underline on hover.

Keyboard focus uses a three-pixel outline, offset five pixels, with color chosen against the surrounding region. The default follows the mode foreground, independent of an inverted button's text color. Evergreen regions use citron; the calendar uses evergreen; cobalt ballot guidance uses pale text. The evergreen navigation uses citron with a four-pixel offset. Keep focus visible around filled project rows as well as text links.

### Navigation

A compact sticky evergreen band carries the citron wordmark and outlined account controls. The homepage uses a text wordmark; its hardware mark is hidden. Account controls retain clear labels, a thin pale border, and a lagoon hover fill. Shared sign-in content remains Field Instrument.

### Selection controls and status

Event selection uses outlined buttons with a citron selected fill and evergreen text. The selected state is also exposed through `aria-pressed`. Status uses readable text alongside a small shape; live fills the circular mark, and recap uses a square outline. Do not encode status through color alone.

### Project rows and gallery cards

Project rows use contrasting pale panels, a small decorative cover, a strong name, supporting text, and a directional arrow. Hover brightens the whole row. Demo Day gallery cards allocate more room to art and switch their caption fill to citron on hover. Project titles remain real content; covers carry no claim about that content.

### Guidance panels

Judging guidance uses evergreen and citron. Ballot guidance uses cobalt and pale text, with numbered steps and a citron action. Both use the same panel radius and padding. Their content explains the next task without imitating submitted scores or an already-built ballot.

### Dated lists and content states

Calendar rows use dates, event names, supporting metadata, a thin top rule, and a directional arrow. Event-name underlining signals hover. Loading and empty project states retain the mode field and use plain text within a thin outline. No skeleton projects or fake project counts become part of the system.

### Retained inputs and overlays

Open House introduces no new text-input design. Existing authentication fields, dialogs, scoring controls, and admin inputs retain their Field Instrument implementations. Do not synthesize a homepage input style and imply it has shipped.

## Do's and Don'ts

### Do:

- Do keep evergreen navigation consistent across homepage modes.
- Do use the mode field and its matching foreground, muted text, and panel colors together.
- Do keep project names and action labels visible alongside decorative art.
- Do preserve visible keyboard focus and the reduced-motion behavior.
- Do keep Field Instrument styling on downstream pages until an explicit redesign changes that scope.

### Don't:

- Don't make white the primary homepage canvas.
- Don't import the hardware chassis, engraved micro-labels, project keycaps, or sequencer into Open House.
- Don't present the abstract covers as project screenshots, logos, or evidence about a project.
- Don't create one generic card layout for all three event modes.
- Don't turn homepage composition or lifecycle choices into app-wide visual rules.
