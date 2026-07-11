# HackJudge Security Audit Report

Date: 2026-07-10 (initial static review: 2026-05-05)
Scope: local repository at `/Users/oea/projects/hack-judge`, including React/Vite frontend, Convex backend functions, HTTP routes, scripts, deployment config, dependency posture, and read-only checks of the live Netlify frontend.

## Executive Summary

The two responsibly disclosed vulnerabilities were confirmed in the implementation:

1. Judge access was represented by a database row, while successful judge-code verification was not persisted or required by score mutations.
2. Appreciation quotas were keyed by a browser-controlled identifier, so deleting browser storage created a new voting identity.

Both issues are remediated in the local working tree. The review also found and locally remediated public admin/seed mutations, overbroad public event/team/prize data, arbitrary score payloads, cohort bypasses, duplicate batch scores, unreleased-result leakage, static import-secret bypasses, public admin exports, QR authorization gaps, post-event participant edits, judge-code brute force, CSV formula injection, unbound Turnstile responses, and raw HTTP error disclosure.

The changes are not a production remediation until the Convex backend and frontend are deployed. Because affected code may have been used at prior events, incident review and data reconciliation are still required.

## Remediation Status

This table supersedes the status language in the historical findings below. Historical evidence and original code locations are retained for traceability; line numbers may have shifted.

| Finding | Local status on 2026-07-10 |
| --- | --- |
| Public admin escalation and destructive seed mutations | Remediated: debug export removed; seed operations are internal mutations |
| Judge-code bypass | Remediated: verification is persisted and required by score, assignment, profile, and role paths |
| Judge-code guessing and rotation | Remediated: five-attempt/15-minute lockout; code changes invalidate prior verification |
| Appreciation storage reset | Remediated: vote budgets use authenticated server identity |
| Arbitrary/duplicate/out-of-cohort score writes | Remediated: exact categories, integer 1-5 values, opt-out policy, active-event/visible-team checks, unique batch teams, and cohort enforcement |
| Public judge codes, hidden teams, entrant emails, import IDs, and unreleased winners | Remediated with role-aware allowlisted DTOs |
| Static import secret | Remediated: bypass removed; scripts require an authenticated Convex token |
| Public appreciation admin data and prize deliberation data | Remediated with admin or verified-judge authorization and sanitized responses |
| QR generation and caller-controlled QR base URL | Remediated: ZIP is admin-only; single QR enforces visibility and configured trusted frontend URL |
| CSV formula injection | Remediated in appreciation and QR exports |
| Browser security headers | Deployed and verified on `https://hackjudge.netlify.app` on 2026-07-11 |
| Dependency advisories and ignored lockfile | Remediated: lockfile tracked; `npm audit` reports zero advisories |
| Forwarded-IP trust | Open operational risk; verify which headers Convex overwrites before relying on IP controls |
| Upload storage abuse | Partially mitigated by auth and active-event scoping; file type, size, quota, and orphan cleanup policy remain |
| Persistent attendee/fingerprint telemetry | Open privacy/retention decision; no longer an authorization identity |

## Additional Findings From The Continued Review

### A1. Score Mutations Trusted Client Payload Shape

Severity: High. Direct Convex callers could submit unknown, missing, duplicate, fractional, out-of-range, or opted-out categories. Batch requests could repeat a team and cohort-enabled events did not consistently require assignment. This could alter rankings independently of the UI. Remediated with server-side validation and handler regression tests.

### A2. Public Queries Leaked Deliberation And Personal Data

Severity: High. Public event/team, Code & Tell, prize, and appreciation queries exposed combinations of unreleased winners, hidden projects, entrant emails, internal actor IDs, import metadata, and moderation totals. Remediated with release gating, role checks, hidden-team enforcement, and allowlisted response objects.

### A3. Participant-Controlled CSV Formula Execution

Severity: Medium. Team names and related imported fields could begin with spreadsheet formula characters and execute when an administrator opened an exported CSV. Remediated by neutralizing leading `=`, `+`, `-`, and `@` after whitespace and applying CSV quote escaping.

### A4. Event And Storage Lifecycle Gaps

Severity: Medium. Team owners could modify project records after an event ended, and any authenticated user could request an upload URL. Team edits now require an active, visible, editable event, and upload URLs require an accessible active event. Server-side upload content limits, quotas, and orphan cleanup remain recommended.

### A5. Verification And Error-Handling Hardening

Severity: Low to Medium. Judge codes had no attempt throttling, Turnstile success was not bound to an action/hostname, and HTTP 500 responses returned internal exception messages. These are locally remediated.

## Incident Review Required

Before treating historical event outcomes as trustworthy:

1. Review user records for unexpected `isAdmin` changes and rotate/remove any previously used import secret.
2. Review score rows for unverified judges, duplicate judge/team rows, out-of-range values, unknown categories, and scores outside assigned cohorts.
3. Review appreciation records for repeated browser identities, suspicious account clusters, IP/fingerprint anomalies, and totals that exceed configured budgets.
4. Recalculate winners from validated records and notify affected event owners if rankings change.
5. Preserve relevant Convex, authentication, and deployment logs before retention windows expire.

## Architecture And Trust Boundaries

Frontend:

- Vite/React SPA with React Router paths in `src/AppNew.tsx`.
- Public routes include `/`, `/event/:eventId`, `/event/:eventId/team/:teamId`, `/profile`, QR redirect `/event/:eventSlug/:teamSlug/:teamId`, and `/admin`.
- Admin routes are rendered at `/admin`, `/admin/insights`, `/admin/events/new`, and `/admin/events/:eventId`.
- The browser calls Convex functions directly through generated API bindings. Any public Convex query, mutation, or action should be treated as callable by users outside the intended UI.

Backend:

- Convex TypeScript functions under `convex/`.
- Auth uses Convex Auth / Google provider, and app authorization is mostly represented by `users.isAdmin`.
- Helpers in `convex/helpers.ts:16-45` define `isAdmin`, `requireAuth`, and `requireAdmin`.
- Public HTTP routes in `convex/http.ts` include Auth routes, `POST /demo-day/appreciations`, `OPTIONS /demo-day/appreciations`, and `GET /api/demo-day/qr`.
- Convex HTTP actions are exposed publicly on the Convex site domain; request parsing and validation are the application code's responsibility.

Reference guidance used:

- Convex function auth docs: https://docs.convex.dev/auth/functions-auth
- Convex function validation docs: https://docs.convex.dev/functions/validation
- Convex HTTP actions docs: https://docs.convex.dev/functions/http-actions
- Local React/frontend security guidance from the `security-best-practices` skill.
- `npm audit` run on 2026-05-05.

## Critical Findings

### C1. Any Signed-In User Can Grant Themselves Global Admin

Severity: Critical

Location:

- `convex/users.ts:143-149`
- `convex/helpers.ts:16-21`, `convex/helpers.ts:38-45`

Evidence:

```ts
export const debugMakeMeAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { isAdmin: true });
    return { success: true };
  },
});
```

Impact:

Any authenticated Google user can become a global platform admin. Because `requireAdmin` trusts `users.isAdmin`, this enables event creation/deletion, score access, results release, team hiding/removal, appreciation review, import workflows, and other admin operations.

Fix:

- Delete `debugMakeMeAdmin` from deployed code, or convert it to an `internalMutation`.
- If an admin bootstrap path is needed, gate it behind an environment-specific one-time setup process that cannot be called from the browser.
- Audit production users for unexpected `isAdmin: true` values after removal.

False Positive Notes:

This is only safe if `convex/users.ts` is guaranteed not to deploy. As an exported public mutation, it is otherwise backend API surface.

### C2. Public Seed/Admin Mutations Can Grant Admin Or Wipe All Data

Severity: Critical

Location:

- `convex/seed.ts:21-65`
- `convex/seeds/admin/clearAllData.ts:3-99`
- `convex/seeds/admin/adminAccess.ts:5-15`, `convex/seeds/admin/adminAccess.ts:46-64`

Evidence:

- `convex/seed.ts:36-39` exports `clearAllData` with no auth wrapper.
- `clearAllDataHandler` deletes events, teams, scores, judges, participants, auth sessions, auth accounts, verification codes, refresh tokens, and users.
- `makeCurrentUserAdminForAllEventsHandler` and `makeUserAdminByEmailHandler` patch `isAdmin: true` without requiring an existing admin.

Impact:

An API caller can cause total data loss or grant platform admin access. This includes deleting auth state and user records.

Fix:

- Remove `convex/seed.ts` from production deployments, or change all seed functions to `internalMutation`.
- Require explicit admin auth on any retained seed-like function.
- Keep destructive data reset operations in local-only scripts that cannot be invoked through public Convex APIs.
- Rotate credentials and review logs if this code has been deployed publicly.

False Positive Notes:

Only safe if seed exports are not present in the deployed Convex project. In Convex, exported mutations are public unless made internal.

## High Findings

### H1. Judge Code Does Not Gate Actual Score Submission

Severity: High

Location:

- `convex/events.ts:147-190`
- `convex/events.ts:193-230`
- `convex/scores.ts:46-69`
- `convex/schema.ts:166-172`

Evidence:

- `joinAsJudge` creates a `judges` row after authentication and event checks, but does not require `judgeCode`.
- `verifyJudgeCodeAndStartJudging` validates the code and returns `true`, but does not persist verified status.
- `submitScore` authorizes score writes by finding a `judges` row only.
- The `judges` table stores only `userId` and `eventId`.

Impact:

If an event expects judge codes to control scoring access, any authenticated user can join as a judge and submit scores without knowing the code.

Fix:

- Add a server-side verification state, such as `judges.codeVerifiedAt`, `judges.codeVerifiedBy`, or a separate judge access table.
- Require that verified state in `submitScore`, `submitBatchScores`, assignment mutations, and any scoring read/write paths that should be protected.
- Consider making `joinAsJudge` require the judge code directly when `event.judgeCode` is set.

False Positive Notes:

If all authenticated users are intended to self-register as judges, this is design-compatible. The existing `judgeCode` field and UI flow indicate it is intended as a gate.

### H2. Public Event And Team Queries Return Overbroad Sensitive Data

Severity: High

Location:

- `convex/events.ts:25-115`
- `convex/events.ts:127-143`
- `convex/teams.ts:481-501`
- `convex/schema.ts:86`, `convex/schema.ts:120-136`

Evidence:

- `listEvents` returns `{ ...event }`, which includes `judgeCode`.
- `getEvent` returns `{ ...event, status, teams, mode }`, where `teams` is the full set for the event.
- `listTeams` lets callers pass `includeHidden: true`; non-admin callers are not prevented from doing so.
- Team records include `hidden`, `entrantEmails`, board assignments, Airtable record IDs, and other internal fields.

Impact:

Non-admin callers can learn judge codes, hidden projects, entrant email lists, board assignments, and internal import metadata. This undermines judge-code gates, hidden-event/team workflows, privacy expectations, and event operations.

Fix:

- Replace broad spread returns with explicit public DTOs.
- Never return `judgeCode` to clients except through admin-only functions.
- Enforce `includeHidden` only for admins.
- Split public team fields from admin/import fields.

False Positive Notes:

Some project details are intentionally public. The issue is the broad shape, not public team browsing itself.

### H3. Static `adminSecret` Bypass Provides A Reusable Backend Admin Path

Severity: High

Location:

- `convex/demoDayImport.ts:1868-2004`
- `scripts/importDemoDay.mjs:22-47`
- `scripts/migrateDS701Teams.mjs:171-183`

Evidence:

Several public mutations accept `adminSecret` and skip `requireAdmin` when it equals `process.env.DEMO_DAY_IMPORT_SECRET`, including:

- `updateTeamBoardAssignment`
- `updateEventCourseCodes`
- `addTeamDirect`
- `renameTeam`
- `importDemoDayEventFromCSVs`

Impact:

If this static secret is copied from a shell, CI log, local machine, or issue thread, it becomes a reusable backend admin bypass. Because the secret is passed as a mutation argument, it can also appear in logs and traces depending on tooling.

Fix:

- Remove `adminSecret` bypasses from public mutations.
- Require Convex auth and `requireAdmin`.
- For server-side imports, use authenticated server-side tooling or internal actions/mutations invoked from a controlled environment.
- Rotate `DEMO_DAY_IMPORT_SECRET` after removing the bypass if it has been used.

False Positive Notes:

This requires secret compromise. It is still high risk because the bypass is intentionally unauthenticated when the secret is supplied.

## Medium Findings

### M1. Demo Day Admin Appreciation Summaries And CSV Data Are Public To Event Viewers

Severity: Medium

Location:

- `convex/appreciations.ts:209-292`
- `convex/appreciations.ts:502-565`

Evidence:

- `getEventAppreciationSummary` is documented as admin dashboard data but only calls `canAccessEvent`.
- `getAppreciationsCsvData` likewise checks event access but not admin status.
- Returned data includes raw/clean appreciation counts, unique attendee counts, flagged status, and CSV export data.

Impact:

Anyone who can access the event can query operational/admin score data, including cleaned versus raw appreciation totals and flagged project status. This can leak moderation signals or live ranking information.

Fix:

- Add `await requireAdmin(ctx)` to admin summary and CSV export functions.
- Create a separate public leaderboard query if public results are intentional.

False Positive Notes:

If these are intended as public live leaderboards, severity drops, but function names/comments indicate admin use.

### M2. QR Generation Exposes Event/Team Metadata Without Backend Authorization

Severity: Medium

Location:

- `convex/http.ts:337-369`
- `convex/qrCodes.ts:749-820`
- `convex/qrCodes.ts:834-970`
- `convex/qrCodesQueries.ts:6-30`, `convex/qrCodesQueries.ts:33-57`, `convex/qrCodesQueries.ts:60-95`

Evidence:

- `GET /api/demo-day/qr` is public and calls `api.qrCodes.generateTeamQrCode`.
- `generateTeamQrCode` and `generateQrCodeZip` do not call `requireAdmin` or `canAccessEvent`.
- Internal QR queries fetch event/team data without hidden checks.
- `generateQrCodeZip` writes team IDs, names, project instances, board fields, course names, and caller-controlled appreciation URLs into a ZIP/CSV.

Impact:

API callers can generate official-looking QR assets and enumerate Demo Day roster/board metadata if they know or obtain event IDs. Caller-controlled `baseUrl` can put arbitrary URLs inside generated QR bundles.

Fix:

- Require admin authorization for ZIP generation.
- For single QR image generation, decide whether public access is required. If public, enforce `canAccessEvent`, hidden-team filtering, and a trusted frontend base URL from configuration rather than caller input.

False Positive Notes:

Impact depends on whether hidden Demo Day events/teams exist and whether event IDs are otherwise exposed.

### M3. Prize Submission Data Is Publicly Readable

Severity: Medium

Location:

- `convex/prizes.ts:257-266`
- `src/components/EventView.tsx:32-33`

Evidence:

`getEventPrizeSubmissions` returns all `teamPrizeSubmissions` rows for an event without auth, event visibility checks, admin checks, or results-release checks.

Impact:

Prize selection/submission data can be queried before deliberation or results release, which may reveal strategy, eligibility, or admin workflow state.

Fix:

- Add `canAccessEvent` at minimum.
- Return only the caller's own team submissions for participants.
- Restrict event-wide submissions to admins, or to public results after release if that is intended.

### M4. Demo Day IP Rate Limiting Trusts Spoofable Forwarding Headers

Severity: Medium

Location:

- `convex/http.ts:15-32`
- `convex/appreciations.ts:421-430`

Evidence:

`getClientIp` trusts `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip`. That value is used by appreciation integrity and IP rate limiting.

Impact:

If the upstream platform does not strip user-supplied forwarding headers, attackers can rotate header values to bypass IP rate limits and weaken fraud signals.

Fix:

- Verify what Convex/hosting actually provides as trusted client IP metadata.
- Only trust forwarding headers set by a known proxy/CDN, and ignore caller-provided values otherwise.
- Keep IP-based controls as a secondary signal, not the sole limiter.

False Positive Notes:

This may be mitigated by infrastructure that overwrites these headers. It was not verified at runtime.

### M5. Security Headers Are Not Visible In Deployment Config

Severity: Medium

Location:

- `vercel.json:1-8`
- `public/_redirects:1`
- `index.html:13-45`

Evidence:

The visible deployment config only defines SPA rewrites. I did not find repo-configured CSP, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. `index.html` also contains an inline script that will need a nonce or hash if a strict CSP is added.

Impact:

If headers are not configured in Vercel/CDN settings, the app lacks browser defense-in-depth for XSS, clickjacking, MIME sniffing, and referrer leakage.

Fix:

- Add headers in `vercel.json` or confirmed edge config.
- Start with a report-only CSP, then enforce once compatible.
- Include `frame-ancestors 'none'` or a specific allowlist unless embedding is required.
- Add `X-Content-Type-Options: nosniff` and a restrictive `Referrer-Policy`.

False Positive Notes:

Headers may exist outside the repo. Verify live production response headers.

### M6. Dependency Posture Has High Advisories And No Committed Lockfile

Severity: Medium

Location:

- `package.json:32`
- `package.json:55`
- `package.json:63`
- `.gitignore:26-27`

Evidence:

`npm audit --json` on 2026-05-05 reported 15 advisories: 0 critical, 8 high, 6 moderate, 1 low. Production audit reported high advisories through `react-router` used by `react-router-dom`.

Notable packages:

- `react-router-dom` range `^7.10.1`
- `happy-dom` range `^20.0.11`
- `vite` range `^6.2.0`

`package-lock.json` exists locally but is ignored by `.gitignore`, so installs are not reproducible from the repo.

Impact:

Different machines/CI can resolve different transitive versions, and known vulnerable ranges can remain installed. The React Router advisories may have lower exploitability for this SPA if SSR/server actions are unused, but the vulnerable package range is present.

Fix:

- Run `npm audit fix` or manually update vulnerable packages.
- Commit the lockfile, or adopt and commit another lockfile consistently.
- Re-run CI and dependency audit after updates.

### M7. Admin Routes Are Client-Gated Only

Severity: Medium

Location:

- `src/AppNew.tsx:39-43`
- `src/features/admin/shell/AdminShell.tsx:7-38`

Evidence:

The `/admin` route and children are present in the SPA route table. `AdminShell` checks `api.auth.loggedInUser` and `api.events.isUserAdmin` before rendering admin UI.

Impact:

Direct navigation to admin routes is possible. This is acceptable only if every backend function used by those views enforces server-side authorization. The backend audit found multiple admin-impacting functions that do not.

Fix:

- Keep client gating as UX only.
- Fix server-side authorization first.
- Add tests that non-admin callers cannot invoke admin-impacting backend functions even when bypassing the UI.

## Low Findings And Hardening Items

### L1. Judging Drafts Persist In `localStorage`

Severity: Low

Location:

- `src/components/EventView.tsx:35-37`
- `src/components/ScoringWizard.tsx:49-55`
- `src/components/ScoringWizard.tsx:230-239`
- `src/components/ScoringWizard.tsx:468-469`

Impact:

Unsubmitted judging scores can remain on shared devices and are readable by browser extensions or any future XSS.

Fix:

- Add a TTL and clear stale drafts automatically.
- Consider session storage or encrypted-at-rest browser storage if drafts must persist.
- Make draft storage opt-in for sensitive events.

### L2. Demo Day Uses Persistent Client-Side Attendee Identifiers And Fingerprints

Severity: Low

Location:

- `src/lib/demoDayIdentity.ts:11-13`
- `src/lib/demoDayIdentity.ts:57-104`
- `src/lib/demoDayIdentity.ts:118-129`
- `src/lib/demoDayApi.ts:249-272`

Impact:

The app creates a one-year client-side attendee ID and sends a browser fingerprint plus optional location/client signals. This is useful for abuse prevention, but it is user-controllable and should not be treated as authentication. It may also require disclosure depending on deployment context and audience.

Fix:

- Document the purpose and retention of these identifiers.
- Use them only as risk signals.
- Consider shorter retention or event-scoped identifiers.

### L3. Dev-Only PostMessage Bridge Imports Remote Code

Severity: Low

Location:

- `vite.config.ts:15-29`

Impact:

In development mode, a parent frame can trigger import of remote Chef tooling if `message.source === window.parent` and `message.data.type === 'chefPreviewRequest'`. This is not a production issue if development builds are never publicly exposed.

Fix:

- Remove Chef dev injection if no longer needed.
- If retained, keep dev servers local-only and avoid deploying development mode.

### L4. Broad Return Shapes And Missing Return Validators Reduce API Safety

Severity: Low

Location Examples:

- `convex/events.ts:27-30`
- `convex/events.ts:129`
- `convex/teams.ts:486`
- `convex/scores.ts:46-58`
- `convex/scores.ts:129-146`
- `convex/auth.ts:9`

Impact:

`v.any()` and missing `returns` validators make accidental data exposure easier. Convex's validation guidance recommends validators on public functions because TypeScript types do not exist at runtime.

Fix:

- Add explicit `returns` validators to public functions.
- Replace `v.any()` public return shapes with minimal DTO validators.
- Add tests that public queries do not include `judgeCode`, `entrantEmails`, hidden records, or import metadata.

## Checked With No Finding

- No `dangerouslySetInnerHTML`, `.innerHTML`, `.outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `DOMParser`, or similar DOM XSS sinks were found in the reviewed frontend code.
- External links with `target="_blank"` found in reviewed files include `rel` protection.
- Public `VITE_*` usage appears limited to Convex URLs and a Cloudflare Turnstile site key, which are expected to be public.
- `.env.local` contains local secret values but is ignored and untracked. Secret values were not copied into this report.

## Recommended Remediation Order

1. Remove `debugMakeMeAdmin` and public seed/admin mutations from deployed API surface.
2. Rotate `DEMO_DAY_IMPORT_SECRET` and remove static-secret bypasses from public mutations.
3. Fix judge-code enforcement by persisting server-side verification and requiring it for score writes.
4. Replace broad public event/team returns with explicit public/admin DTOs.
5. Restrict admin-looking summary/export/QR/prize-submission queries to admin or released-public states.
6. Add server-side authorization tests for admin, judge, participant, and anonymous roles.
7. Add security headers in deployment config and verify live headers.
8. Update dependencies, commit a lockfile, and include `npm audit --omit=dev` in CI.
9. Add privacy/retention notes for Demo Day attendee identifiers and shorten retention if feasible.

## Residual Risk

This audit combined source review, handler-level regression tests, dependency auditing, production builds, and read-only checks of the public frontend. The live frontend returned the SPA for `/`, `/admin`, and `/profile`, and HSTS was present, but CSP, clickjacking, MIME-sniffing, referrer, and permissions headers were not observed. The local header changes must be verified after deployment.

The audit did not authenticate against production, invoke production write operations, inspect the live Convex database, verify Google OAuth policy, or prove which forwarding headers Convex overwrites. A controlled staging penetration test using anonymous, participant, judge, and admin accounts remains necessary before declaring the deployed environment clean.
