## Launch / distribution

- Privacy policy + support pages — add public routes (e.g. `/legal/privacy`, `/legal/support`) so we
  have stable URLs. Needed to:
  - Activate Slack **Public Distribution** (requires a Privacy Policy URL + support contact; this is
    self-serve/instant — NOT the multi-week Slack Marketplace review, which we don't need).
  - Submit to the Shopify App Store (same URLs required there).
- After the legal pages exist: flip on Slack Public Distribution for the prod Cart Radar Slack app so
  merchants in any workspace can connect.

## Scheduler hardening (later)

- Current: in-process `setInterval` (60s) started in `hooks.server.ts` → `evaluateAbandonedCheckouts()`.
  Fine for a single persistent Railway process. Multi-instance safe: fresh alerts via the atomic
  `status: active → abandoned` claim; retries via an optimistic `alertAttempts` counter claim.
- Self-heal is in place: abandoned-but-unalerted carts (transient send failure / crash mid-dispatch)
  are retried, bounded by max attempts (5) + a 2-min cooldown.
- When decoupling/scaling: trigger the secret-guarded `POST/GET /api/cron/evaluate` (CRON_SECRET) from an
  external scheduler (Railway cron / Upstash QStash / GitHub Actions) and stop the in-process loop.
- For durable retries/backoff/scheduled jobs at scale: migrate to `pg-boss` (job queue on the existing
  Postgres — no new infra).

## Features Post Launch

- 'Get help with my order' widget (helps with future integrations to collect customer data before checkout)
  - This of course means that attribution will be a little tricky...

## My TODOs to Check

- High value cart alerts in settings should be enabled by default
- Should double check if sub retains expiring upon moving back to 'free' (downgrading). Also how does expiry / resetting back to free work?
- Adding / deleting emails should update instantly (without clicking save)
- App Icon (For Slack + Shopify App)

## Post Launch Testing

- Test Slack
- Test Email
