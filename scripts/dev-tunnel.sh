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
