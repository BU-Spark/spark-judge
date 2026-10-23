#!/usr/bin/env bash
# Pushes convex/ to mild-loris-998, the deployment hackjudge.netlify.app uses.
# `convex dev` records the deployment it used in .env.local, so the local
# file is restored afterwards and keeps pointing at the dev backend.
set -euo pipefail
cd "$(dirname "$0")/.."
backup="$(mktemp)"
cp .env.local "$backup"
trap 'cp "$backup" .env.local; rm -f "$backup"' EXIT
CONVEX_DEPLOYMENT=dev:mild-loris-998 npx convex dev --once
