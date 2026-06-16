/**
 * Database schema for Shopify app session storage
 * Uses Drizzle ORM with PostgreSQL
 *
 * Run `pnpm run db:push` to apply schema changes
 * Run `pnpm run db:studio` to browse data
 */
import {
	pgTable,
	text,
	boolean,
	timestamp,
	integer,
	numeric,
	jsonb,
	uuid,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * Session table for Shopify OAuth session storage
 * Stores both online (user-specific) and offline (store-wide) sessions
 */
export const session = pgTable('session', {
	// Primary key - session ID format: "offline_{shop}" or "online_{shop}_{userId}"
	id: text('id').primaryKey(),

	// Shop domain, e.g., "example.myshopify.com"
	shop: text('shop').notNull(),

	// OAuth state parameter for CSRF protection
	state: text('state').notNull(),

	// Whether this is an online (user-specific) or offline (store-wide) session
	isOnline: boolean('is_online').default(false).notNull(),

	// Comma-separated list of granted scopes
	scope: text('scope'),

	// When the access token expires (for online sessions)
	expires: timestamp('expires', { mode: 'date' }),

	// The OAuth access token
	accessToken: text('access_token').notNull(),

	// Online session user info (from OnlineAccessInfo)
	userId: text('user_id'),
	firstName: text('first_name'),
	lastName: text('last_name'),
	email: text('email'),
	accountOwner: boolean('account_owner').default(false),
	locale: text('locale'),
	collaborator: boolean('collaborator').default(false),
	emailVerified: boolean('email_verified').default(false),

	// Refresh token support (for expiring offline access tokens)
	refreshToken: text('refresh_token'),
	refreshTokenExpires: timestamp('refresh_token_expires', { mode: 'date' })
});

export type CheckoutStatus =
	| 'active' // checkout still being worked on (or below inactivity window)
	| 'abandoned' // inactive past window + matched a rule, alert not yet sent
	| 'alerted' // alert(s) sent, waiting to see if it recovers
	| 'recovered' // order placed after we alerted
	| 'completed'; // order placed without us ever alerting

export type AlertChannel = 'email' | 'slack';
export type AlertStatus = 'queued' | 'sent' | 'failed';

/**
 * How a recovery was attributed:
 * - 'token': the order carried the same checkout_token (exact)
 * - 'email' / 'phone': inferred — a later order from the same customer within
 *   the attribution window, started as a fresh checkout (different token)
 * - 'draft_order': a draft order the merchant created from this cart in Cart
 *   Radar was completed (exact)
 */
export type RecoveryMatch = 'token' | 'email' | 'phone' | 'draft_order';

export interface LineItemSnapshot {
	title: string;
	quantity: number;
	price: string;
	variantTitle: string | null;
	sku: string | null;
	// Numeric variant ID from the checkout webhook (used to build draft orders)
	variantId: number | null;
}

/**
 * One row per installed shop. Plan state lives here; the Free-tier monthly alert
 * count is derived live from `checkouts.alertedAt` (see getPlanState).
 */
export const shops = pgTable('shops', {
	shop: text('shop').primaryKey(),
	shopName: text('shop_name'),
	currency: text('currency'),
	// Days after an alert that a later order from the same customer still counts
	// as an (inferred) recovery. Read live at order time — see markCheckoutOrdered.
	attributionWindowDays: integer('attribution_window_days').default(14).notNull(),
	// billingActive is true once the merchant approves the $29/mo Pro subscription.
	// Free is the default (no subscription); Pro unlocks unlimited alerts.
	billingActive: boolean('billing_active').default(false).notNull(),
	billingSubscriptionId: text('billing_subscription_id'),
	// Which interval the active Pro subscription is billed on.
	billingInterval: text('billing_interval').$type<'monthly' | 'annual'>(),
	// When a cancelled Pro subscription's paid period ends. Shopify cancels
	// immediately, but the merchant paid through this date, so we keep them on Pro
	// until it passes — then they fall to Free. Null when never cancelled / active.
	proAccessUntil: timestamp('pro_access_until', { mode: 'date' }),
	installedAt: timestamp('installed_at', { mode: 'date' }).defaultNow().notNull(),
	uninstalledAt: timestamp('uninstalled_at', { mode: 'date' })
});

/**
 * Alert trigger rules (currently one rule per shop).
 * A checkout fires a rule when totalPrice >= thresholdAmount
 * (or itemCount >= minItemCount, when set) after inactivityMinutes of no activity.
 */
export const alertRules = pgTable(
	'alert_rules',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shop: text('shop').notNull(),
		enabled: boolean('enabled').default(true).notNull(),
		thresholdAmount: numeric('threshold_amount', { precision: 12, scale: 2 }).notNull(),
		minItemCount: integer('min_item_count'),
		inactivityMinutes: integer('inactivity_minutes').default(60).notNull(),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
	},
	(t) => [index('alert_rules_shop_idx').on(t.shop)]
);

/**
 * Per-shop notification channel configuration (one row per shop).
 * Recipients live in `alertRecipients` so each can be verified independently.
 */
export const channelSettings = pgTable('channel_settings', {
	shop: text('shop').primaryKey(),
	emailEnabled: boolean('email_enabled').default(true).notNull(),
	slackEnabled: boolean('slack_enabled').default(false).notNull(),
	// Channel webhook URL + name obtained via Slack OAuth ("Connect Slack").
	slackWebhookUrl: text('slack_webhook_url'),
	slackChannelName: text('slack_channel_name'),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export type RecipientChannel = 'email';

/**
 * Alert recipients (email addresses), each confirmed via a one-time link before
 * it can receive alerts. We never send to an unconfirmed address — clicking the
 * link proves inbox control and protects deliverability.
 */
export const alertRecipients = pgTable(
	'alert_recipients',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shop: text('shop').notNull(),
		channel: text('channel').$type<RecipientChannel>().notNull(),
		// Email address
		destination: text('destination').notNull(),
		verified: boolean('verified').default(false).notNull(),
		// Current confirmation-link token (cleared once confirmed)
		verificationCode: text('verification_code'),
		verificationSentAt: timestamp('verification_sent_at', { mode: 'date' }),
		verificationExpiresAt: timestamp('verification_expires_at', { mode: 'date' }),
		verificationAttempts: integer('verification_attempts').default(0).notNull(),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('alert_recipients_shop_channel_dest_idx').on(t.shop, t.channel, t.destination),
		index('alert_recipients_shop_channel_idx').on(t.shop, t.channel)
	]
);

/**
 * Checkouts tracked from checkouts/create|update webhooks.
 * Customer fields are PII — customers/redact must null them out.
 */
export const checkouts = pgTable(
	'checkouts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shop: text('shop').notNull(),
		checkoutToken: text('checkout_token').notNull(),
		shopifyCheckoutId: text('shopify_checkout_id'),
		abandonedCheckoutUrl: text('abandoned_checkout_url'),
		totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
		currency: text('currency').notNull(),
		itemCount: integer('item_count').default(0).notNull(),
		customerName: text('customer_name'),
		customerEmail: text('customer_email'),
		customerPhone: text('customer_phone'),
		lineItems: jsonb('line_items').$type<LineItemSnapshot[]>().default([]).notNull(),
		status: text('status').$type<CheckoutStatus>().default('active').notNull(),
		checkoutCreatedAt: timestamp('checkout_created_at', { mode: 'date' }),
		lastActivityAt: timestamp('last_activity_at', { mode: 'date' }).notNull(),
		alertedAt: timestamp('alerted_at', { mode: 'date' }),
		// Delivery attempts made for this cart's alert. Lets the evaluator retry
		// transient send failures (self-heal) without re-alerting indefinitely.
		alertAttempts: integer('alert_attempts').default(0).notNull(),
		recoveredAt: timestamp('recovered_at', { mode: 'date' }),
		recoveredOrderId: text('recovered_order_id'),
		recoveredAmount: numeric('recovered_amount', { precision: 12, scale: 2 }),
		recoveryMatch: text('recovery_match').$type<RecoveryMatch>(),
		// Draft order created from this cart inside the app (merchant-initiated
		// recovery). The draft_orders/update webhook attributes its completion.
		draftOrderId: text('draft_order_id'),
		draftOrderName: text('draft_order_name'),
		draftOrderCreatedAt: timestamp('draft_order_created_at', { mode: 'date' }),
		updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('checkouts_shop_token_idx').on(t.shop, t.checkoutToken),
		index('checkouts_status_activity_idx').on(t.status, t.lastActivityAt),
		index('checkouts_shop_status_idx').on(t.shop, t.status)
	]
);

/**
 * One row per alert delivery attempt, per channel.
 */
export const alerts = pgTable(
	'alerts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shop: text('shop').notNull(),
		checkoutId: uuid('checkout_id').references(() => checkouts.id, { onDelete: 'cascade' }),
		channel: text('channel').$type<AlertChannel>().notNull(),
		recipient: text('recipient'),
		status: text('status').$type<AlertStatus>().default('queued').notNull(),
		error: text('error'),
		providerMessageId: text('provider_message_id'),
		isTest: boolean('is_test').default(false).notNull(),
		sentAt: timestamp('sent_at', { mode: 'date' }),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
	},
	(t) => [index('alerts_shop_created_idx').on(t.shop, t.createdAt)]
);
