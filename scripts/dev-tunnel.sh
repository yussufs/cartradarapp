#!/usr/bin/env bash
#
# Starts the Cloudflare named tunnel, then runs `shopify app dev` against the
# stable tunnel URL so the public URL (and therefore the Slack + Shopify redirect
# URLs) never changes between sessions. The tunnel is torn down on exit.
#
# Override any of these via env vars if your tunnel differs:
#   DEV_TUNNEL_NAME  - cloudflared named tunnel to run
#   DEV_TUNNEL_HOST  - the public hostname routed to that tunnel
#   DEV_TUNNEL_PORT  - the local port the tunnel forwards to (and that the
#                      Shopify CLI proxy listens on). MUST NOT be 3457 — that's
#                      the CLI's internal default (GraphiQL), and reusing it
#                      causes "EADDRINUSE 3457".
#
# ─────────────────────────────────────────────────────────────────────────────
# GOTCHA: stale JS in the embedded app (Cloudflare caches the tunnel)
# ─────────────────────────────────────────────────────────────────────────────
# The *-dev.dragonapps.io tunnel hostname is proxied through Cloudflare, which
# by default slaps a 4-hour Browser Cache TTL (cache-control: max-age=14400) on
# anything ending in .js — INCLUDING SvelteKit's .svelte-kit/generated/client/
# app.js route manifest. That manifest's URL never changes but its contents do
# every time you add/rename/remove a route.
#
# Symptoms (all the SAME bug, after editing the route tree):
#   • "TypeError: loader is not a function" + a 500 on the newest route, OR
#   • one route silently renders a DIFFERENT route's page (e.g. /app/onboarding
#     showing the settings page — node indices shifted but the browser kept the
#     old manifest), OR
#   • HMR edits just don't show up.
# It survives normal reloads because the browser honors the 4h max-age.
# Server logs stay clean — it's a client-side hydration error.
#
# PERMANENT FIX (Cloudflare dashboard, dragonapps.io zone — do once):
#   1. Caching → Configuration → Browser Cache TTL → "Respect Existing Headers".
#   2. Caching → Cache Rules → new rule:
#        When:  ends_with(http.host, "-dev.dragonapps.io")
#        Then:  Bypass cache
#   Result: dev .js comes back as cf-cache-status: BYPASS / cache-control:
#   no-cache, so route + HMR changes show up instantly.
#
# RIGHT NOW (if you're staring at a stale page): DevTools → Network →
# "Disable cache" → reload (applies to the app iframe too), or CF → Purge
# Everything once.
set -euo pipefail

TUNNEL_NAME="${DEV_TUNNEL_NAME:-cartradar-dev}"
TUNNEL_HOST="${DEV_TUNNEL_HOST:-cartradar-dev.dragonapps.io}"
LOCAL_PORT="${DEV_TUNNEL_PORT:-8080}"

if ! command -v cloudflared >/dev/null 2>&1; then
	echo "error: cloudflared is not installed (brew install cloudflared)" >&2
	exit 1
fi

# A crashed/overlapping previous session can leave the Shopify CLI proxy bound to
# the port, causing EADDRINUSE. Free it before we start.
STALE_PIDS="$(lsof -ti "tcp:${LOCAL_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "${STALE_PIDS}" ]; then
	echo "▶ Port ${LOCAL_PORT} busy — killing leftover process(es): ${STALE_PIDS}"
	echo "${STALE_PIDS}" | xargs kill -9 2>/dev/null || true
	sleep 1
fi

echo "▶ Starting Cloudflare tunnel '${TUNNEL_NAME}' → http://localhost:${LOCAL_PORT}"
cloudflared tunnel run --url "http://localhost:${LOCAL_PORT}" "${TUNNEL_NAME}" &
TUNNEL_PID=$!

# Tear the tunnel down whenever this script exits (Ctrl-C, error, or normal exit).
cleanup() {
	kill "${TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Give the tunnel a moment to connect before the CLI starts proxying to it.
sleep 3

echo "▶ Running shopify app dev on https://${TUNNEL_HOST}:${LOCAL_PORT}"
shopify app dev --tunnel-url="https://${TUNNEL_HOST}:${LOCAL_PORT}"
