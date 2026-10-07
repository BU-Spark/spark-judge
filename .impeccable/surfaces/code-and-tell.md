# Code & Tell participant workspace

Scope: `CodeAndTellWorkspace.tsx`, `workspace.css`, and the contained `CodeAndTellVoteView.tsx`; `CodeAndTellPreview.tsx` supplies sample data for inspection. Other modes and homepage tiles keep their existing Open House treatment. Scoped visual tokens and rules live in root `DESIGN.md`.

- **Thesis:** Put the participant's current task first.
- **World:** Teal and pale paper with IBM Plex Sans typography, thin project-row rules, and flat surfaces. The invitation and winner panel share a rounded lower-right corner.
- **Story:** Arrive from the event QR code, sign in, rank eligible projects, then wait for organizer-controlled result release. Presenter signup remains outside this round; projects are collected through the existing Google Form.
- **First viewport:** Before voting, show the project list and a voting-not-open message. During voting, lead with sign-in, then show searchable projects beside the ballot. Event name, date, and current stage provide compact context.
- **Form:** A focused workspace, centered on recognizing projects and saving a ranked ballot. No schedule-led hero or supplementary information sections.

## States and responsive behavior

Preserve loading, signed-out, ballot editing, saving, saved, error, no-project, closed-voting, and released-result states. A successful save follows the save promise. Keep ballot eligibility, exact required ranking count, and visible reorder controls intact. Participant names are public; teammate emails remain private.

Workspace grids stack at 760px. The shared ballot still supplies its sticky desktop board and phone jump control; inspect their inherited breakpoint behavior when changing layout. The compact invitation removes its decorative bottom content on phones. Keep footer clearance for fixed controls.

## Evidence and limits

Recorded from component and stylesheet source on 2026-10-06. Browser screenshots were unavailable; this is not visual QA or deployment verification. Preview projects, ballot totals, and stage controls are explicit fixtures, not event evidence. The decorative ampersand is display text, not an interaction icon. Do not promote preview chrome or inherited legacy results decoration into reusable workspace rules.

IBM Plex Sans selected by the user as the working typeface. Self-hosted regular, medium, semibold, and bold faces; the preview defaults to Plex. Homepage alignment is being scoped separately.

## Event title rule

Use “Code & Tell” as the display title and “Monthly Demo Night” as the smaller subtitle in the workspace and homepage event rows. Show the event date, including the year, separately in metadata. Keep the stored event name intact for administration and website mappings. Never place the month/year prefix or subtitle in the large heading.
