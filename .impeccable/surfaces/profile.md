---
version: 1
slug: "profile"
primary_target: "src/components/ProfilePage.tsx"
related_targets: ["src/components/ProfilePage.fi.css", "src/components/home/PlatformHeader.tsx", "src/components/auth/SignInDialog.tsx", "src/components/auth/sign-in.css", "src/AppNew.tsx"]
---

# Profile surface brief

<!-- impeccable:surface-brief -->

## Scope
`/profile`, its shared platform header, and sign-in dialog. Visitor mode: Operate.
The user extended the homepage's competition-platform direction to profile and authentication on October 7, 2026. Admin remains outside this change.

## Audience and job
A judge between sessions: resume active judging, see upcoming assignments, and review completed events.

## Direction
Match the current homepage with self-hosted IBM Plex Sans, pale paper `#f6f7f2`, dark green `#103c3b`, mint `#dcece3`, and thin `#ccd7d1` rules.
- Active judging uses mint panels with the real event name, mode, progress, and start/resume action.
- Upcoming and completed events use simple rows with details/results actions. Completed events remain collapsible.
- The header repeats the homepage brand and account menu. Keep private account data inside the profile/account surfaces.
- Signed-out and empty states explain the next step with a single sign-in or browse-events action.
- The shared native sign-in dialog uses sentence-case Google sign-in, a mint button, an accessible close control, and plain pending/error feedback.

## Constraints and verification
Preserve profile queries, event navigation, scoring counts, and completed disclosure. Do not reinterpret score calculations or invent assignments. Grids stack at 760px; dialogs fit inside the viewport and restore focus on close.
Desktop and 390px layouts were inspected with the real signed-out route and temporary populated/empty sample-data fixtures. The sample profile is visual QA, not evidence of a real user's assignments. Google OAuth itself is not exercised by the visual review.
