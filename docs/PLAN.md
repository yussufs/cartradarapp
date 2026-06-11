# Cart Radar — High-Value Cart Abandonment Alerts: Build Plan

App: **Cart Radar | Large Cart Alerts** (name already set in `shopify.app.toml`).
Goal: detect abandoned checkouts above a merchant-defined value threshold and alert the
merchant immediately via Email, Slack, and SMS, with a recovery toolkit and analytics.
Monetization: free tier (10 alerts/mo) + usage-based paid tier via the Shopify Billing API.

Decisions (2026-06-11): email via **Amazon SES**; deploy on **Railway** (single long-running
Node process — in-process scheduler is fine); **SMS ships in v1**; no customer-outreach
toolkit (merchants' native abandoned-checkout emails cover customer contact — we only show
contact info and the recovery URL); protected-customer-data request handled by the owner
in the Partner Dashboard.

---

## 1. How detection works (the core technical decision)

Shopify has **no "checkout became abandoned" webhook**. Two mechanisms exist:

1. **Webhooks**: `checkouts/create` and `checkouts/update` fire on every checkout activity
   (requires `read_orders` scope). `orders/create` fires on purchase (used to detect recovery).
2. **Polling**: the `abandonedCheckouts` Admin GraphQL query with filters
   (`recovery_state:not_recovered status:open updated_at:>...`), plus `abandonedCheckoutsCount`.

**Chosen architecture — webhook-tracked, poller-confirmed:**

- `checkouts/create|update` webhooks upsert a row in our `checkouts` table with
  `last_activity_at`, total price, line items snapshot, and contact info.
- A background scheduler (runs every 5 min) finds rows where
  `now - last_activity_at > inactivity_window` (default 60 min, merchant-configurable)
  AND `total_price >= threshold` AND status is still `active` → marks `abandoned` → enqueues alert.
- The checkout webhook payload already carries `abandoned_checkout_url`, total price, line
  items, and customer contact — v1 alerts straight from our DB snapshot (no extra API call).
  A periodic reconciliation poll of `abandonedCheckouts` (Phase 5) guards against missed
  webhooks.
- `orders/create` webhook matches `checkout_token` → marks row `recovered` (or `completed`
  if no alert was ever sent), records recovered order value for analytics.
- A reconciliation poll (every few hours) sweeps `abandonedCheckouts` to catch anything
  webhooks missed.

**Scheduler implementation:** in-process interval started from the server entry
(adapter-node, single long-running process — fine for v1). Structure the job code under
`src/lib/shared/` (the template's framework-agnostic layer with `connection.ts` +
`standalone.ts` admin client) so it can be lifted into a separate worker process when scale
demands. Jobs must be idempotent and lease-based (a `job_locks` row or `FOR UPDATE SKIP LOCKED`)
so running two instances never double-alerts.

## 2. Scopes, app config, and compliance prerequisites

- **Scopes**: change `write_products` → `read_orders,read_customers` in `shopify.app.toml`
  and `.env`/`SCOPES`. (`read_orders` covers abandoned checkouts + checkout/order webhooks;
  `read_customers` for customer name/email/phone.)
- **Protected customer data — Level 2** (name, email, phone, address): must be requested in
  the Partner Dashboard (Apps → API access → Protected customer data access) with per-field
  justifications. Works on dev stores immediately after submitting the request; full review
  happens at app-store submission. **Do this early — it gates everything customer-related.**
- **Webhook subscriptions** to declare in `shopify.app.toml` (api_version already `2026-07`):
  - `checkouts/create`, `checkouts/update` → `/webhooks/checkouts`
  - `orders/create` → `/webhooks/orders`
  - `app_subscriptions/update`, `app_subscriptions/approaching_capped_amount` → `/webhooks/billing`
    (toml already declares `app_subscriptions/update` pointing at `/webhooks/app-subscriptions`
    — route is MISSING today; consolidate under `/webhooks/billing`)
  - `shop/update` → `/webhooks/shop-update` (declared, route MISSING — implement or remove)
  - existing: compliance trio, `app/uninstalled`, `app/scopes_update`
- **GDPR compliance webhooks**: currently stubs. Must become real once we store customer
  PII: `customers/redact` deletes/anonymizes our checkout snapshots for that customer;
  `customers/data_request` exports what we hold; `shop/redact` already deletes sessions —
  extend to all shop data.
- Fix placeholders: `application_url`/`redirect_urls` are `https://example.com`; `.env.example`
  documents only `DATABASE_URL` — add all required vars.

## 3. Database schema (new Drizzle tables)

```
shops               — shop domain (PK), install/uninstall timestamps, shop currency, timezone,
                      plan (free|pro|scale), billing_subscription_id, usage_line_item_id,
                      alerts_used_this_period, period_started_at
alert_rules         — id, shop, enabled, threshold_amount, threshold_currency,
                      min_item_count (nullable alt. trigger), inactivity_minutes (default 60),
                      channels jsonb (which of email/slack/sms this rule fires)
channel_settings    — shop, email_recipients text[], slack_webhook_url,
                      sms_recipients text[] (E.164), per-channel enabled flags, verified flags
checkouts           — id, shop, checkout_token (unique per shop), shopify_gid,
                      abandoned_checkout_url, total_price, currency, item_count,
                      customer_name/email/phone (nullable PII — see redaction),
                      line_items jsonb snapshot, status enum
                      (active|abandoned|alerted|recovered|completed|expired),
                      created_at, last_activity_at, alerted_at, recovered_at,
                      recovered_order_id, recovered_amount
alerts              — id, shop, checkout_id, rule_id, channel (email|slack|sms),
                      status (queued|sent|failed), error, provider_message_id, sent_at
usage_charges       — id, shop, alert_id, amount, idempotency_key,
                      shopify_usage_record_id, created_at  (audit trail for billing)
```

Workflow: `pnpm run db:generate` + migration files (production), `db:push` in dev.

## 4. Alert channels

| Channel | Provider                                                | v1 cost basis   | Notes                                                                                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email   | **Amazon SES** ($0.10/1k)                               | ~$0.0001/alert  | Needs a verified sending domain + DKIM/SPF in SES. HTML template: cart value, items w/ images, customer name/email/phone, deep-link to dashboard + `abandonedCheckoutUrl`.                                                                                                                                                              |
| Slack   | **Incoming webhook URL** pasted by merchant in settings | $0              | Block Kit message mirroring the email. "Send test" button to validate the URL.                                                                                                                                                                                                                                                          |
| SMS     | **Twilio, one shared verified toll-free number**        | ~$0.013/segment | Toll-free verification avoids A2P 10DLC brand/campaign fees entirely. Messages go to the _merchant's own_ opted-in phone (operational alert, not marketing) — light compliance. Keep copy under 1 segment (160 chars): "🛒 $1,240 cart abandoned by Jane D. — view: <short link>". Telnyx ($0.004/seg) is the cost-down migration path. |

Channel layer design: a single `sendAlert(checkout, rule, channels)` dispatcher in
`src/lib/server/alerts/` with per-channel adapters, per-channel result logging into `alerts`,
retry-once semantics, and quota check (free tier) + usage-record creation (paid) wrapped
around it. A "send test alert" path reuses the exact same adapters with fake cart data.

## 5. Embedded app UI (custom component library already in repo)

Replace all Puzzlify placeholder pages. Follow the template's data-loading pattern
(minimal `+page.server.ts`, data via `/api/*` endpoints authorized with App Bridge session tokens).

- **Dashboard (`/app`)** — KPI cards: high-value abandonments this month, alerts sent,
  recovered count, **$ recovered** (the ROI headline). Table of recent high-value abandoned
  checkouts (customer, value, items, time, status badge, actions). Setup checklist
  (threshold set → channel connected → test alert sent → billing plan).
- **Checkout detail (`/app/checkouts/[id]`)** — full line items w/ images, customer contact
  card, alert history, copy recovery URL / `mailto:` / `tel:` convenience links. (No in-app
  customer outreach: merchants' native abandoned-checkout emails cover that.)
- **Settings (`/app/settings`)** — threshold amount (shop currency), optional item-count
  trigger, inactivity window, channel config (email recipients, Slack webhook w/ test,
  SMS numbers w/ verification), uses `data-save-bar`.
- **Billing (`/app/billing`)** — current plan, alerts used this period, usage cap status,
  upgrade buttons → `appSubscriptionCreate` confirmation URL flow.
- **API endpoints**: `/api/dashboard`, `/api/checkouts`, `/api/checkouts/[id]`,
  `/api/settings` (GET/PUT), `/api/alerts/test`, `/api/billing` (GET/POST plan change).

## 6. Billing (Shopify Billing API)

- **Free**: no subscription. Hard cap of 10 alerts/mo enforced in the dispatcher
  (counter on `shops`, reset by period). Email + Slack only. Banner at 8/10 used.
- **Paid**: `appSubscriptionCreate` with **two line items**: recurring
  (`appRecurringPricingDetails`, EVERY_30_DAYS) + usage (`appUsagePricingDetails` with
  `terms` and `cappedAmount`). Redirect merchant to `confirmationUrl`; activate on
  `app_subscriptions/update` webhook. 14-day trial. `test: true` on dev stores.
- **Per-SMS usage**: `appUsageRecordCreate` per SMS sent beyond included volume,
  `idempotencyKey = alert id`. Record in `usage_charges`.
- **Cap management**: handle `app_subscriptions/approaching_capped_amount` (fires at 90%)
  → notify merchant in-app + email; offer `appSubscriptionLineItemUpdate` to raise the cap
  (merchant re-approves via new confirmation URL). If cap is hit, `appUsageRecordCreate`
  errors → degrade gracefully: still send email+Slack, queue/skip SMS, show banner.

### Proposed pricing (see §9 of the final summary for margin math)

| Tier      | Price      | Included                                                                                               | Overage (usage line item)                               |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **Free**  | $0         | 10 alerts/mo, email + Slack only, 1 rule                                                               | —                                                       |
| **Pro**   | **$15/mo** | Unlimited email + Slack alerts, **50 SMS/mo included**, recovery analytics                             | **$0.05/SMS**, default cap $25/mo (merchant-adjustable) |
| **Scale** | **$39/mo** | Everything in Pro, **300 SMS/mo included**, multiple rules/thresholds, multiple recipients per channel | **$0.04/SMS**, default cap $60/mo                       |

Rationale: email/Slack are ~zero marginal cost → sell as "unlimited" (strong perceived
value). SMS is the only real COGS (~$0.013 blended Twilio US incl. carrier fees) → meter it.
$0.05/SMS ≈ 74% gross margin on the marginal unit; included volumes cost us ≤$4/mo (Pro ≥73%
blended margin, Scale ≥80%). Comparable single-channel notification apps charge $5–10/mo;
multi-channel power-merchant apps run $49–99 — $15/$39 undercuts while one recovered $1k cart
pays for years of the product.

## 7. Build phases

**Phase 0 — Housekeeping (small)**
Scopes, toml URLs, missing webhook routes (`/webhooks/billing`, `/webhooks/shop-update`),
`.env.example`, submit protected-customer-data request, strip Puzzlify placeholder pages.

**Phase 1 — Detection pipeline (the heart)**
Schema migration → `checkouts/create|update` webhook handlers → scheduler + abandonment
evaluation → `orders/create` recovery matching → reconciliation poll. Testable end-to-end
with console-log "alerts" before any channel exists.

**Phase 2 — Alert channels + settings UI**
Alert dispatcher + Resend email + Slack adapters, settings page, test-alert flow,
free-tier quota counter. _(App is demo-able / soft-launchable here.)_

**Phase 3 — SMS + billing**
Twilio adapter (after toll-free verification clears — start verification during Phase 1,
it takes days), billing plans + usage records + cap handling, billing page, plan gating.

**Phase 4 — Dashboard & analytics**
Dashboard KPIs ($ recovered!), checkout detail page with contact info and recovery-URL link,
alert history.

**Phase 5 — Hardening & App Store submission**
Real GDPR webhook implementations, uninstall data cleanup, rate-limit/retry handling on
GraphQL, empty/error states, verify everything with cookies disabled (CLAUDE.md rule),
data protection questionnaire, listing copy ("Recovered a $2k sale you would have lost"),
screenshots, review submission.

## 8. Testing strategy

- Dev store + `shopify app dev`; trigger real checkouts (dev stores support test checkouts).
- Webhook replay via Shopify CLI `shopify app webhook trigger` for checkouts/orders topics.
- `test: true` subscriptions for the whole billing flow on the dev store.
- Unit tests around threshold evaluation, quota/period reset, and recovery matching
  (`checkout_token` join) — these are the money paths.
- Manual checklist: cookies disabled end-to-end, cap-exceeded degradation, uninstall→reinstall.
