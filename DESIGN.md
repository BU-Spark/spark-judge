---
name: HackJudge
description: The Field Instrument — the judging console as a Teenage Engineering-class pocket instrument — light milled chassis, dark display module, project keyboard, semester sequencer rail.
colors:
  desk: "#ddd9d0"
  chassis: "#eceae4"
  panel: "#e3e0d7"
  hair: "#cfccc0"
  hair-lit: "#f7f5ee"
  ink: "#1a1c1e"
  ink-soft: "#42443e"
  ink-dim: "#5b5d55"
  screen: "#12181d"
  screen-edge: "#080c0f"
  screen-deep: "#0b1115"
  screen-ink: "#e8edee"
  screen-dim: "#9fb0b5"
  key-white: "#fbfaf6"
  encoder-orange: "#ff6b2c"
  encoder-orange-hot: "#ff7d45"
  encoder-orange-edge: "#d14d16"
  encoder-orange-shadow: "#c74e17"
  transport-ink: "#14100c"
  encoder-blue: "#3d7bff"
  encoder-green: "#2fbf71"
  house-teal: "#0d9488"
  teal-deep: "#0a6e63"
  teal-phosphor: "#2dd4bf"
  mode-blue-deep: "#1d4ed8"
  mode-blue-lit: "#7fa8ff"
  mode-green-deep: "#14713f"
  mode-green-lit: "#4ade80"
  chassis-edge: "#c4c1b6"
  key-edge: "#b9b6ab"
  rule: "#b3b0a4"
  step-past: "#a8a599"
  step-past-edge: "#8f8c81"
  key-pressed: "#f2f0e9"
  row-hover: "#efede6"
  ledger-name: "#43453f"
  stamp-ink: "#4e5048"
  stamp-edge: "#b3afa2"
  screen-hair: "#2a383f"
  screen-bezel: "#1e2a30"
  screen-tag: "#6b7f86"
  select-dim: "#7d9198"
  scope-grid: "#1b262c"
typography:
  display:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "clamp(1.55rem, 3.2vw, 2.3rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  zone:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "clamp(1.3rem, 2.4vw, 1.7rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  small:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  wordmark:
    fontFamily: "Instrument Sans, Helvetica Neue, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
  engraved:
    fontFamily: "IBM Plex Mono, SFMono-Regular, monospace"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
  engraved-sm:
    fontFamily: "IBM Plex Mono, SFMono-Regular, monospace"
    fontSize: "0.5625rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.13em"
  readout:
    fontFamily: "IBM Plex Mono, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  pip: "2px"
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  module: "16px"
  unit: "22px"
  full: "999px"
spacing:
  xs: "0.55rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.25rem"
  pad-x: "clamp(1rem, 3.5vw, 2.75rem)"
  zone-y: "clamp(1.5rem, 3.5vw, 2.5rem)"
components:
  transport-key:
    backgroundColor: "{colors.encoder-orange}"
    textColor: "#14100c"
    rounded: "{rounded.lg}"
    padding: "0.85em 1.3em"
    typography: "{typography.readout}"
  transport-key-hover:
    backgroundColor: "{colors.encoder-orange-hot}"
    textColor: "#14100c"
    rounded: "{rounded.lg}"
    padding: "0.85em 1.3em"
    typography: "{typography.readout}"
  soft-key:
    backgroundColor: "{colors.key-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.55em 0.9em"
    typography: "{typography.readout}"
  panel-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1.4rem 1.5rem"
  key-tile:
    backgroundColor: "{colors.key-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "clamp(0.65rem, 1.6vw, 0.95rem)"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.screen-dim}"
    rounded: "{rounded.sm}"
    padding: "0.3em 0.6em"
    typography: "{typography.engraved}"
  live-chip:
    backgroundColor: "transparent"
    textColor: "{colors.teal-phosphor}"
    rounded: "{rounded.sm}"
    padding: "0.3em 0.6em"
    typography: "{typography.readout}"
---

# Design System: HackJudge

## Overview

**Creative North Star: "The Field Instrument"**

HackJudge is rendered as a precision pocket instrument in the Teenage Engineering lineage: a light, milled warm-gray chassis carrying a dark display module, a keyboard of square project keys, and a sequencer rail for time. It is an Operate surface first — a console a judge works in for hours — but every control is machined, labeled, and a little playful, because the instrument makers proved that pro tools can be joyful without becoming toys.

The system's whole discipline is one sentence: **knobs are inputs, meters are outputs.** Anything the user can change earns an interactive control with real travel; anything the user merely reads earns an honest readout — on the event card, not in a stat band. Color is load-bearing, never decorative: hardware hues mark parameters (orange / blue / green / white), event modes are color-coded (hackathon teal, code & tell blue, demo day green), and house teal is reserved for HackJudge itself — wordmark, focus, selection.

HackJudge is not an event-marketing surface. The events it judges (DS+X, CivicHacks, and the Code & Tell / Demo Day formats) have their own sites; this homepage is the console for the event in front of you.

**Key Characteristics:**
- A single floating chassis (`unit`, max 1120px, 22px radius) on a darker workbench ground; below 1160px it loses the margin and radius and becomes the full-bleed face
- Engraved micro-labels (IBM Plex Mono, uppercase, wide tracking, highlight under-shadow) instead of helper text
- The dark display module is where color and motion live: one authored canvas animation per surface, mode-tinted
- Square project keys with LED accents, 3px press travel, and honest dashed "open slot" keys
- Time rendered as a sequencer: the semester rail docks under the display module, its live step patched to the screen by a dogleg lead; step-sequencer upcoming list, engraved ledger for the past

## Colors

The palette is an object: warm gray chassis, dark screen glass, hardware accent colors, one house teal.

### Primary
- **Chassis** (`#eceae4`): the instrument face every surface sits on. Light because judges work in lit rooms, warm because it is an object, not a website.
- **House Teal** (`#0d9488`, deep `#0a6e63` for text on chassis, phosphor `#2dd4bf` on the dark screen): the HackJudge thread — focus rings, selection, the SELECT readout accent, the live state when hackathon mode is active.

### Secondary
- **Encoder Orange** (`#ff6b2c`, hot `#ff7d45`): transport and commit actions — the Start Scoring key is always orange.
- **Encoder Blue** (`#3d7bff`) / **Encoder Green** (`#2fbf71`): hardware accent hues, and the mode colors for Code & Tell and Demo Day respectively. Text-safe variants: blue `#1d4ed8` on chassis / `#7fa8ff` on screen; green `#14713f` on chassis / `#4ade80` on screen.
- **Key White** (`#fbfaf6`): raised key caps and soft-key buttons.

### Neutral
- **Desk** (`#ddd9d0`): the workbench ground behind the unit; only visible outside the chassis.
- **Panel** (`#e3e0d7`): recessed sub-panels (semester rail, event log, tooltip readouts).
- **Ink** (`#1a1c1e`), **Ink Soft** (`#42443e`), **Ink Dim** (`#5b5d55`): text on the chassis, each tinted from the ground hue — never neutral gray.
- **Screen** (`#12181d`, deep `#0b1115`, edge `#080c0f`), **Screen Ink** (`#e8edee`), **Screen Dim** (`#9fb0b5`): the display module's glass and its two reading levels.
- **Hair** (`#cfccc0`) / **Hair Lit** (`#f7f5ee`): scored panel lines and the engraved highlight beneath them.

### Named Rules
**The Tinted-Ink Rule.** Secondary text is always tinted from the surface it sits on (warm ink on chassis, phosphor-dim on screen). Neutral gray helper text is banned.

**The Mode-Color Rule.** Event modes are color-coded: hackathon = teal, Code & Tell = blue, Demo Day = green. The active mode color lights the top-rail pictogram, the screen's mode chip, and the rail's live step and patch lead. House teal never performs a non-house job while another mode is active.

## Typography

**Display/UI Font:** Instrument Sans (with Helvetica Neue)
**Engraved/Data Font:** IBM Plex Mono (with SFMono)

**Character:** a crisp neutral grotesk for sentences and names; a small mono reserved for what the machine engraves or measures — labels, dates, codes. Mono is measurement here, never costume.

### Hierarchy
- **Display** (700, clamp 1.55–2.3rem, -0.02em): the live event's name on the display module; balanced wrapping.
- **Zone** (700, clamp 1.3–1.7rem, -0.015em): section words (Projects, Upcoming, Past). No kickers or eyebrows — the heading carries its own weight.
- **Title** (600, 1.05rem): key names, track names.
- **Body** (400, 1rem, 1.55): descriptions; measure ≤65ch.
- **Engraved** (500, 0.625rem, +0.16em, uppercase): micro-labels, with a 1px light under-shadow as the engraving cut.
- **Readout** (600, 0.6875rem, +0.1em, uppercase): data values, chips, dates, CTA label.

### Named Rules
**The Engraving Rule.** Anything the device would print on its case is set in engraved mono; anything the device would show is set in the UI sans. The two never swap.

## Layout

One centered chassis column (max 1120px) with a fluid side pad (clamp 1rem → 2.75rem). Interior rhythm is zoned: display module, semester rail (docked to the module via the patch lead), project keyboard, sequencer, event log, footer — each zone separated by a scored hairline, with more space above a zone heading than below it. Grids collapse by halving: 4-up keys go 2-up at 700px; the rail staggers its date labels into two rows at 560px; below 1160px the chassis drops its margin, radius, and side borders and runs full-bleed.

## Elevation & Depth

The world is a flat object with real joinery: depth comes from the chassis floating on the desk (one soft ambient shadow), the display module's inset screen shadow, and 1px hairline/highlight pairs that read as scored and engraved seams. No glows-as-decoration, no hard offset block shadows.

### Shadow Vocabulary
- **Unit ambient** (`0 24px 48px rgba(26,28,30,0.14), 0 3px 10px rgba(26,28,30,0.08)`): the chassis resting on the desk.
- **Screen inset** (`inset 0 2px 10px rgba(0,0,0,0.55), 0 1px 0 #f7f5ee`): glass sunk into the face.
- **Key rest** (`0 4px 9px rgba(26,28,30,0.12)`) → **pressed** (`0 1px 3px rgba(26,28,30,0.16)` + 3px travel): mechanical state, not hover polish.

### Named Rules
**The Travel Rule.** Pressable things move when pressed (keys 3px, transport 2px, soft keys 1px). If it can't move, it isn't a key — it's a readout.

## Shapes

Machined rectangles with purposeful radii: pips and step LEDs nearly square (2–3px), chips and status stamps small (5–6px), keys and rail panels at 12px, the display module 16px, the chassis itself 22px. LEDs are the only circles. Dashed 1.5px borders mark empty slots honestly; nothing else is dashed.

## Components

### Buttons
- **Shape:** transport radius (10px) for the primary commit; soft keys at 8px.
- **Primary (Transport Key):** encoder orange with near-black engraved label, 1px darker orange seam, rest shadow, 2px press travel. There is one transport key per surface and it names the verb ("Start Scoring").
- **Soft Key:** key-white cap with hairline border for rail actions (Sign in); 1px travel.
- **Hover / Focus:** hovers deepen fill or border toward the bound color; focus is a 2px house-teal outline, 3px offset, everywhere.

### Chips
- **Style:** transparent with a 1px screen-hue border, engraved mono text. The mode chip takes the active mode color; the LIVE chip pairs phosphor text with a pulsing 8px LED dot (reduced-motion safe).

### Project Keyboard (signature)
- Square white key caps (1:1, 12px radius) in a 4-column grid, each with an 8px LED in the project's own hue from event data, an engraved index, an authored stroke-consistent SVG glyph, name, and team in engraved mono. Press travels 3px and reports to the display module's SELECT readout (an aria-live line). Unfilled slots render as dashed "open slot" keys — the grid is honest about capacity.

### Semester Rail (signature)
- The semester as a clean sequencer rail docked directly beneath the display module — the module's time axis, not a standalone zone: no zone word, just engraved labels in the channel above it ("Semester" / "Track 00 · window · count"). A ruled bed with engraved month ticks; events as 12px steps on the rule — past steps dim filled, upcoming steps hollow in their mode color and filling on hover, the live step solid in the active mode color and pulsing. Dates hang off hairline connectors; names appear as engraved tooltip readouts on hover/focus; every step is a link to its section.
- **The Patch Lead (named move):** the live step is patched to the display it feeds — routed, never straight, and never decorated: a 2px lead in the active mode color rises from the live step, sweeps through smooth rounded elbows (no chamfers, no hard corners), runs across the 96px channel on clean chassis, and curves up into a single input jack on the module's bottom edge. Each event mode has its own socket position and color (Code & Tell left/blue, hackathon center/teal, Demo Day right/green); only the jack in use is rendered — 9px, screen-dark, solid mode-color core, chassis bezel halo. No unused jacks, no jack labels, no bus hardware. The channel carries no hairline — the run is the divider. Here is the event; behind it, what happened; ahead, what's armed.

### Sequencer & Event Log
- **Upcoming** is a track list: mode-colored LED, name, a bank of step LEDs encoding countdown, dates, and a T-minus readout. Empty state is an honest idle panel: unlit steps and an engraved "NO EVENTS QUEUED" line, never a marketing blank.
- **Past** is an engraved ledger: solid hairline dividers, date, name, mode, and a stamped COMPLETE chip. No tape idiom anywhere — no sprockets, no perforations.

### Navigation
- The top rail is the instrument's faceplate: engraved wordmark with teal pixel, the three mode pictograms (active mode lit in its color), mono session readouts, and a soft-key Sign in. Below 640px the rail wraps; nothing hamburgers.

## Do's and Don'ts

### Do:
- **Do** tint every secondary text from its surface hue (Ink Soft on chassis, Screen Dim on glass).
- **Do** give every pressable control real travel and a state change; keep the SELECT readout live.
- **Do** color-code modes end to end: pictogram, screen chip, playhead, sequencer LEDs.
- **Do** reserve house teal for HackJudge itself: focus, selection, wordmark, live hackathon state.
- **Do** render empty and idle states as instrument idles (unlit steps, dashed slots, engraved status lines).
- **Do** keep exactly one authored motion per surface — the display module's canvas; everything else is 160ms state feedback and the live LED pulse, all reduced-motion safe.

### Don't:
- **Don't** ship a strip of big-number metric tiles that repeat what the event card already says — hero-metric stat bands are marketing furniture, and marketing lives on the event's own site (The No Stat-Band Rule).
- **Don't** render knobs, dials, or rotary encoders for read-only values — knobs are inputs (The Knobs-Are-Inputs Rule).
- **Don't** use neutral gray text, gradient text, or kicker/eyebrow labels above headings.
- **Don't** scatter motion across sections or add glow as decoration; phosphor bloom belongs to lit LEDs only.
- **Don't** let a stock component survive inside the instrument — nav, chips, inputs, and lists are rebuilt in the machine's vocabulary.
