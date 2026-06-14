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
- **Billing reconcile sweep:** add a periodic job that runs `syncBillingState()` across shops to catch
  missed `app_subscriptions/update` webhooks (e.g. a `FROZEN`/`EXPIRED` we never received). Today billing
  status only reconciles via the webhook + on each billing-page load, so a missed webhook can leave
  `shops.billingActive` stale until the merchant next opens billing. (The cancel→grace→Free transition is
  immune — it's computed live from `proAccessUntil` — this only affects the Shopify-status mirror.)

## Features Post Launch

- 'Get help with my order' widget (helps with future integrations to collect customer data before checkout)
  - This of course means that attribution will be a little tricky...

## My TODOs to Check

- [DONE] Downgrade behaviour — implemented period-end grace: cancel stops Shopify renewal but keeps Pro
  until `currentPeriodEnd` (via `shops.proAccessUntil`), then auto-falls to Free. Covers both the in-app
  cancel and Shopify-admin cancel (webhook reads `currentPeriodEnd`). See "Billing reconcile sweep" above
  for the remaining missed-webhook gap.
- App Icon (For Slack + Shopify App)

## Post Launch Testing

- Test Slack
- Test Email
