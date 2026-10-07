# Development frontend

URL: https://hackjudge-dev-development.up.railway.app

Railway project: `HackJudge` (`a4e2d662-52c5-45b7-936e-53dd044ab769`)
Environment: `development` (`da8f4c80-db45-4fe1-bf12-4faa8e5da30f`)
Service: `hackjudge-dev` (`01e15ec4-5928-4bee-8c37-bb9255653978`)

The frontend uses the existing Convex development deployment, `mild-loris-998`.
Its `SITE_URL` points to the development frontend for authentication redirects.
Build variables are `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`; no backend
credentials belong in the frontend build. Nginx serves the Vite output on port
8080 and falls back to `index.html` for client-side routes.

Keep deployments scoped to the development environment and `dev` branch.
Railway is connected to `BU-Spark/spark-judge` and automatically deploys pushes
to `dev` using the Dockerfile.
The existing Netlify production frontend is separate.

Event stages are organizer controlled. In the event admin, change Participant
stage to open or close Code & Tell voting; the scheduled end time does not
automatically close it. Confirm the winner before releasing results.

`convex/eventImport.ts` is an internal operator import, not a public endpoint.
Pass an existing event ID for metadata corrections. It upserts projects without
deleting ballots or teams. Keep response exports and presenter email addresses
out of Git.
