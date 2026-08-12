# Homepage surface brief

<!-- impeccable:surface-brief -->

## Scope
`/` landing hub + shared shell tone for event-entry CTAs. Visitor mode: Operate.
Out of scope: full EventView and admin redesign.

## Audience & job
Judges first under time pressure; also admins, participants, attendees.
Job: feel semester pulse and enter the right mode-specific action.

## Direction
A+C hybrid (B rejected). One focal event (pre/live/post); project strip; Upcoming/Past lists.
Teletext in UI chrome (page codes, phase, cyan figures); no heavy outer frame; no Active carousel.
Usability wins conflicts. Post hold 48h; pre window 7d.

## Memorable moment
Focal phase board + one primary CTA.

## Composition
Approved: `.impeccable/mocks/homepage-comp-d.webp`

## Inventory
| Ingredient | Medium |
| Status band | HTML/CSS |
| Focal panel + CTAs | React + CSS |
| Project strip | React + CSS (initial tiles) |
| Upcoming/Past rows | React + CSS |
| LIVE blink | CSS + reduced-motion |
| Phase selection | `src/lib/homepagePhase.ts` |

## Constraints
Keep event-mode capabilities and auth. Teal/amber brand + teletext cyan. No fake social feed.
