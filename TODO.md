- [DONE] Easy Testing Harness — /app/dev page + /api/dev seed endpoint (gated by DEV_TOOLS). Spawns abandoned carts (real catalog products), runs the evaluator on demand, simulates recovery, flips plan, resets.
- [DONE] SES / Dummy Email Logging — in dev with no SES creds, alerts log to the server console instead of sending.
- [DONE/Understanding] Scheduler — in-process setInterval (60s) in hooks.server.ts → evaluateAbandonedCheckouts(); see "Scheduler hardening" below.
- [REMOVED] Twilio / SMS — dropped entirely for v1.
- 'Get help with my order' widget (helps with future integrations to collect customer data before checkout)
  - This of course means that attribution will be a little tricky...
- App Icon

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

## Testing

- High value cart alerts in settings should be enabled by default
- Test Slack Alerts
- Test Email
