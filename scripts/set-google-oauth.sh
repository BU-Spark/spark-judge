#!/usr/bin/env bash
# Sets the Google sign-in client on a Convex deployment without echoing the
# secret or saving it to shell history.
#
#   bash scripts/set-google-oauth.sh dev    # limitless-eagle-110 (local dev)
#   bash scripts/set-google-oauth.sh live   # mild-loris-998 (hackjudge.netlify.app)
#
# Before changing live, the current values are saved to
# ~/.hackjudge-google-oauth-backup (readable only by you) so they can be
# restored with:  bash scripts/set-google-oauth.sh restore-live
set -euo pipefail
cd "$(dirname "$0")/.."

backup="$HOME/.hackjudge-google-oauth-backup"

case "${1:-}" in
  dev) deployment="dev:limitless-eagle-110" ;;
  live) deployment="dev:mild-loris-998" ;;
  restore-live)
    [ -f "$backup" ] || { echo "No backup at $backup"; exit 1; }
    # shellcheck disable=SC1090
    source "$backup"
    CONVEX_DEPLOYMENT=dev:mild-loris-998 npx convex env set AUTH_GOOGLE_ID -- "$OLD_AUTH_GOOGLE_ID" >/dev/null 2>&1
    CONVEX_DEPLOYMENT=dev:mild-loris-998 npx convex env set AUTH_GOOGLE_SECRET -- "$OLD_AUTH_GOOGLE_SECRET" >/dev/null 2>&1
    echo "Restored the previous Google client on live."
    exit 0
    ;;
  *) echo "Usage: $0 dev|live|restore-live"; exit 1 ;;
esac

read -r -p "Google Client ID: " client_id
read -r -s -p "Google Client secret (hidden): " client_secret
echo

if [[ ! "$client_id" =~ \.apps\.googleusercontent\.com$ ]]; then
  echo "That doesn't look like a Google client ID (should end in .apps.googleusercontent.com)."
  exit 1
fi
if [ -z "$client_secret" ]; then
  echo "Client secret is empty."
  exit 1
fi

if [ "$1" = "live" ] && [ ! -f "$backup" ]; then
  old_id="$(CONVEX_DEPLOYMENT="$deployment" npx convex env get AUTH_GOOGLE_ID 2>/dev/null)"
  old_secret="$(CONVEX_DEPLOYMENT="$deployment" npx convex env get AUTH_GOOGLE_SECRET 2>/dev/null)"
  umask 077
  printf 'OLD_AUTH_GOOGLE_ID=%q\nOLD_AUTH_GOOGLE_SECRET=%q\n' "$old_id" "$old_secret" > "$backup"
  echo "Saved the current live client to $backup"
fi

CONVEX_DEPLOYMENT="$deployment" npx convex env set AUTH_GOOGLE_ID -- "$client_id" >/dev/null 2>&1
CONVEX_DEPLOYMENT="$deployment" npx convex env set AUTH_GOOGLE_SECRET -- "$client_secret" >/dev/null 2>&1
echo "Google sign-in client updated on $1 ($deployment)."
