![HackJudge](public/hackjudge-logo.svg)

# HackJudge

HackJudge is an event judging and showcase platform built for hackathons, Demo
Days, and Code & Tell events. Organizers manage each format through one admin
workspace, while participants and attendees get an experience tailored to the
event they are joining.

## Event modes

| Mode | Participant experience | Organizer workflow |
| --- | --- | --- |
| **Hackathon** | Judges score teams from 1–5 against weighted rubric categories. Drafts are saved locally until the judge submits completed teams in one batch; teams may be left unscored after confirmation. | Configure rubrics, prizes, judge codes, cohorts, and assignments; lock scoring; review score dashboards; select winners; and release results. |
| **Demo Day** | Visitors browse projects; signed-in attendees give a limited number of “Love Tap” appreciations. QR codes can open a project directly. | Import projects, configure appreciation budgets, review integrity signals and findings, clean results, and export data. |
| **Code & Tell** | Signed-in attendees rank the required number of eligible projects—up to five—on one ballot. Project owners cannot vote for a project associated with their own email. | Configure ballot limits, monitor deterministic ranked standings, select the winner, and release results. |

Events without an explicit mode are treated as hackathons for backwards
compatibility.

## Highlights

- One event and admin model across three distinct participation formats
- Google sign-in through Convex Auth
- Weighted rubrics, judge verification, cohorts, and team assignments
- Atomic score submission and scoring locks for reliable deliberation
- Prize configuration, winner selection, and controlled result release
- Demo Day project browsing, QR codes, configurable appreciation limits, and
  integrity review
- CSV and Airtable-assisted Demo Day imports
- Ranked Code & Tell ballots with deterministic point and tie-break logic
- Responsive React UI backed by real-time Convex queries and mutations

## Tech stack

- [React 19](https://react.dev/) and
  [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for the frontend toolchain
- [Convex](https://www.convex.dev/) for data, server functions, HTTP routes,
  scheduled work, and authentication
- [React Router](https://reactrouter.com/) for application and admin routing
- [Chakra UI](https://chakra-ui.com/), Tailwind CSS, Emotion, and Framer Motion
  for the interface
- [Vitest](https://vitest.dev/) and Testing Library for tests

The package metadata still uses the historical name `flex-template`; the
product itself is HackJudge.

## Getting started

### Prerequisites

- Node.js and npm
- A Convex account and development deployment
- Google OAuth credentials for sign-in

### Install and run

```bash
git clone <repository-url>
cd hack-judge
npm install
npm run dev
```

`npm run dev` starts Vite and `convex dev` together. Convex will guide you
through creating or selecting a development deployment and will populate the
local deployment values used by the frontend.

The app is served by Vite (normally at `http://localhost:5173`). Keep the
combined development process running so frontend and generated Convex bindings
stay in sync.

### Configure authentication

Run Convex configuration once so `.env.local` exists. The repository includes
`setup.mjs`, which then runs the Convex Auth setup helper:

```bash
node setup.mjs
```

Configure the Google provider and site URLs in the Convex deployment
environment. For example:

```bash
npx convex env set AUTH_GOOGLE_ID "<google-client-id>"
npx convex env set AUTH_GOOGLE_SECRET "<google-client-secret>"
npx convex env set SITE_URL "http://localhost:5173"
```

Use your production frontend URL for `SITE_URL` in production. Never commit
`.env.local` or secret values.

## Configuration reference

Convex CLI and frontend variables are normally stored in `.env.local`.
Server-side values belong in the selected Convex deployment environment.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT` | Convex CLI | Selects the local Convex development deployment. |
| `VITE_CONVEX_URL` | Frontend | Connects the React client to Convex. |
| `VITE_CONVEX_SITE_URL` | Frontend | Optional explicit base URL for Demo Day HTTP endpoints; otherwise derived from `VITE_CONVEX_URL`. |
| `CONVEX_SITE_URL` | Convex Auth / server | Canonical Convex HTTP-actions site URL. |
| `AUTH_GOOGLE_ID` | Convex server | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Convex server | Google OAuth client secret. |
| `SITE_URL` | Convex server | Public frontend origin used for auth, request validation, and generated links. |

Optional Demo Day integrations:

| Variable | Purpose |
| --- | --- |
| `AIRTABLE_PAT` | Airtable personal access token for server-side imports. |
| `AIRTABLE_BASE_ID` | Airtable base containing Demo Day data. |
| `AIRTABLE_ASSIGNMENTS_TABLE` | Overrides the default `Assignments` table name. |
| `AIRTABLE_PROJECT_INSTANCES_TABLE` | Overrides the default `Project Instances` table name. |
| `AIRTABLE_PROJECTS_TABLE` | Overrides the default `Projects` table name. |
| `VITE_TURNSTILE_SITE_KEY` | Enables Cloudflare Turnstile in the frontend. |
| `TURNSTILE_SECRET_KEY` | Verifies Turnstile tokens in Convex HTTP actions. |
| `TURNSTILE_EXPECTED_HOSTNAME` | Optionally pins Turnstile verification to a hostname. |

QR generation resolves the public frontend URL from `SITE_URL`,
`FRONTEND_URL`, or `PUBLIC_SITE_URL`, in that order.

## Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the frontend and Convex backend together. |
| `npm run dev:frontend` | Runs Vite only. |
| `npm run dev:backend` | Runs `convex dev` only. |
| `npm run build` | Builds the production frontend into `dist/`. |
| `npm run lint` | Typechecks the Convex and app TypeScript projects, runs `convex dev --once`, and builds the frontend. Requires configured Convex access. |
| `npm test` | Runs the complete Vitest suite once. |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run test:coverage` | Runs the suite with coverage reporting. |
| `npm run test:ui` | Opens the Vitest UI. |

## Project map

```text
.
├── convex/                   # Schema, auth, queries, mutations, actions, and HTTP routes
│   ├── schema.ts             # Shared data model for all event modes
│   ├── helpers.ts            # Authorization and server-side DTO helpers
│   ├── events.ts             # Event lifecycle and administration
│   ├── scores.ts             # Hackathon scoring and score summaries
│   ├── appreciations.ts      # Demo Day appreciation limits and counts
│   ├── demoDayIntegrity.ts   # Demo Day integrity review
│   ├── demoDayImport.ts      # CSV and Airtable import pipeline
│   ├── codeAndTell.ts        # Ranked ballots, standings, and results
│   └── http.ts               # HTTP route registration and implementations
├── public/                   # Static assets and hosting headers/redirects
├── scripts/                  # Authenticated data-import utilities
├── src/
│   ├── AppNew.tsx            # Top-level route tree and page wrappers
│   ├── components/           # Participant, judge, and mode-specific UI
│   ├── features/admin/       # Route-based admin workspace
│   └── lib/                  # Shared frontend helpers
├── tests/                    # Vitest and Testing Library suites
└── vercel.json               # Vercel SPA rewrites and security headers
```

### Main routes

| Route | Surface |
| --- | --- |
| `/` | Event discovery, sign-in, judge joining, and event entry |
| `/event/:eventId` | Mode-aware judging, browsing, or voting |
| `/event/:eventId/team/:teamId` | Project detail and Demo Day appreciation |
| `/profile` | Judge progress across events |
| `/admin` | Admin event workspace |
| `/admin/insights` | Platform-level insights |
| `/admin/events/new` | Event creation |
| `/admin/events/:eventId` | Event details, teams, prizes, scores, and winners |

## Data imports

Demo Day CSV imports can run through the admin UI or the helper script:

```bash
CONVEX_URL="https://<deployment>.convex.cloud" \
CONVEX_AUTH_TOKEN="<authenticated-admin-token>" \
node scripts/importDemoDay.mjs "/path/Assignments.csv" "/path/Projects.csv"
```

The migration and import scripts require an authenticated admin token; they do
not perform anonymous imports. Keep input files and credentials out of version
control.

## Deployment

The frontend is a static Vite build. `vercel.json` configures single-page-app
rewrites and response headers for Vercel; `public/_headers` and
`public/_redirects` provide Netlify-compatible equivalents.

Deploy the Convex backend and frontend as separate parts of the release:

1. Configure production Convex environment variables.
2. Deploy the Convex functions and schema.
3. Build the frontend with its production `VITE_CONVEX_URL` and, when needed,
   `VITE_CONVEX_SITE_URL`.
4. Deploy `dist/` to the frontend host.
5. Update `SITE_URL` and OAuth callback configuration to the final public
   origin.

## Contributing

1. Create a focused branch.
2. Match the existing module boundaries and TypeScript conventions.
3. Add or update tests for behavior changes.
4. Run `npm test` and `npm run build` before opening a pull request.

New route-based admin work belongs in `src/features/admin/`. Avoid adding new
route behavior to the legacy dashboard compatibility layer.

Changes to shared event fields or navigation must be checked in all three event
modes because each mode has a different participation and trust model.
