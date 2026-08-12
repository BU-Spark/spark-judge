---
version: 1
slug: "shell"
primary_target: "src/AppNew.tsx"
related_targets: ["src/index.css", "src/components/ui/BrandLogo.tsx", "src/components/ThemeToggle.tsx", "index.html", "public/theme-init.js"]
---

# Shell surface brief

<!-- impeccable:surface-brief -->

## Scope
The global frame on every routed page: top rail header, mobile menu, sign-in modal,
toaster, loading/error primitives. Visitor mode: Operate (it must disappear into use).
Out of scope: route content.

## Audience & job
Everyone, always. Job: orient (where am I, am I signed in) and get out of the way.

## Direction
The instrument's faceplate, from the Field Instrument previews:
- Engraved wordmark left (BrandMark + HACKJUDGE in Instrument Sans 700, 0.14em tracking,
  uppercase — not the old 26px sentence-case wordmark).
- Center-left: mono session readouts (engraved-sm, ink-dim) — quiet, honest.
- Right: soft keys (key-white tiles, readout mono type) for Profile / Admin / Sign in.
- No hamburger anywhere: the rail wraps below 640px; nav items are few by design.
- Sticky is fine; the rail is chassis (`--chassis`) with a hairline bottom and a lit
  top edge (`--hair-lit`), 64px desktop / 56px mobile.
- Mode pictograms (hackathon/code-tell/demo-day glyphs) only appear on event surfaces,
  lit in the event's mode color — not in the global shell.

## Decisions (locked 2026-08-12)
- **Light-only v1.** The Field Instrument is a light-chassis world; dark is reserved for
  display modules. ThemeProvider may stay mounted, but theme-init.js forces light,
  the theme-color meta is the chassis tone, and the ThemeToggle leaves the header
  (component file kept for a possible future night-panel variant).
- **Sign-in dedup:** the Layout modal is the single sign-in surface; the landing's
  SignInOverlay gets removed when the homepage rebuild lands.

## Inventory
| Ingredient | Medium |
| ---------- | ------ |
| Top rail | `Layout` in `src/AppNew.tsx` |
| Wordmark | `src/components/ui/BrandLogo.tsx` |
| Tokens | `src/index.css` (`fi-*` layer) |
| Sign-in modal | `Layout` + `SignInFormNew` |
| Toasts | sonner, styled to panel tokens |

## Constraints
Keep auth flow and admin gating behavior identical. Focus rings: 2px house teal.
Rail must not exceed 56–64px tall; content routes keep their own max-widths during
migration (homepage chassis is 1120px).
