/**
 * Shopify Billing: a single flat-rate recurring subscription ($29/month) that
 * the merchant approves once to unlock the Pro plan (unlimited alerts). Shops
 * without an active subscription are on the Free plan, capped at
 * BILLING.freeAlertsPerMonth alerts per calendar month.
 */
import { and, eq, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getOfflineSession } from '$lib/server/shopify/auth';
import { createAdmin, throwOnErrors, type AdminClient } from '$lib/server/shopify/graphql';
import { db } from '$lib/server/db';
import { checkouts, shops } from '$lib/shared/db/schema';
import { BILLING, type Plan } from './plans';
import { adminAppUrl } from '$lib/server/alerts/format';

async function getOfflineAdmin(shop: string): Promise<AdminClient> {
	return createAdmin(await getOfflineSession(shop));
}

interface UserError {
	field?: string[] | null;
	message: string;
}

function throwOnUserErrors(userErrors: UserError[] | undefined, context: string): void {
	if (userErrors && userErrors.length > 0) {
		throw new Error(`${context}: ${userErrors.map((e) => e.message).join(', ')}`);
	}
}

/**
 * Creates the $29/month recurring subscription and returns the confirmation URL
 * the merchant must approve. Activation lands via app_subscriptions/update.
 */
export async function activateBilling(shop: string): Promise<string> {
	const admin = await getOfflineAdmin(shop);

	const response = await admin.graphql<{
		appSubscriptionCreate: { userErrors: UserError[]; confirmationUrl: string | null };
	}>(
		`#graphql
		mutation CartRadarBillingActivate(
			$name: String!
			$returnUrl: URL!
			$lineItems: [AppSubscriptionLineItemInput!]!
			$test: Boolean
		) {
			appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
				userErrors { field message }
				confirmationUrl
				appSubscription { id }
			}
		}`,
		{
			variables: {
				name: BILLING.subscriptionName,
				returnUrl: adminAppUrl(shop, '/app/billing'),
				test: env.BILLING_TEST_MODE === 'true',
				lineItems: [
					{
						plan: {
							appRecurringPricingDetails: {
								price: { amount: BILLING.proPriceUsd.toFixed(2), currencyCode: 'USD' },
								interval: BILLING.interval
							}
						}
					}
				]
			}
		}
	);

	const data = throwOnErrors(response);
	throwOnUserErrors(data.appSubscriptionCreate.userErrors, 'appSubscriptionCreate');
	if (!data.appSubscriptionCreate.confirmationUrl) {
		throw new Error('appSubscriptionCreate returned no confirmation URL');
	}
	return data.appSubscriptionCreate.confirmationUrl;
}

/**
 * Cancels the subscription. Shopify cancels immediately (CANCELLED is terminal),
 * but the merchant already paid through currentPeriodEnd, so we keep them on Pro
 * until then (period-end grace) and only fall to Free once it passes. Returns the
 * grace end date, or null if there was nothing to cancel.
 */
export async function cancelSubscription(shop: string): Promise<Date | null> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	if (!shopRow?.billingSubscriptionId) return null;

	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		appSubscriptionCancel: {
			userErrors: UserError[];
			appSubscription: { id: string; status: string; currentPeriodEnd: string | null } | null;
		};
	}>(
		`#graphql
		mutation CartRadarBillingCancel($id: ID!) {
			appSubscriptionCancel(id: $id) {
				userErrors { field message }
				appSubscription { id status currentPeriodEnd }
			}
		}`,
		{ variables: { id: shopRow.billingSubscriptionId } }
	);

	const data = throwOnErrors(response);
	throwOnUserErrors(data.appSubscriptionCancel.userErrors, 'appSubscriptionCancel');

	// `prorate` defaults to false, so no refund — the merchant keeps Pro through
	// the period they paid for. Shopify's sub is now terminal, so we drop
	// billingActive but grant grace locally until currentPeriodEnd.
	const periodEnd = data.appSubscriptionCancel.appSubscription?.currentPeriodEnd ?? null;
	const proAccessUntil = periodEnd ? new Date(periodEnd) : null;
	await db
		.update(shops)
		.set({ billingActive: false, billingSubscriptionId: null, proAccessUntil })
		.where(eq(shops.shop, shop));
	return proAccessUntil;
}

/**
 * Records a cancellation that we learn about from the app_subscriptions/update
 * webhook (covers cancels done directly in Shopify admin, not just our own
 * button): drop the active flag but keep Pro until the paid period ends by
 * reading the subscription's currentPeriodEnd. If we can't read it, we leave any
 * existing grace untouched rather than wiping it.
 */
export async function recordCancellation(
	shop: string,
	subscriptionId: string | null
): Promise<void> {
	let proAccessUntil: Date | null | undefined;
	if (subscriptionId) {
		try {
			const admin = await getOfflineAdmin(shop);
			const response = await admin.graphql<{ node: { currentPeriodEnd: string | null } | null }>(
				`#graphql
				query CartRadarSubscriptionPeriodEnd($id: ID!) {
					node(id: $id) {
						... on AppSubscription {
							currentPeriodEnd
						}
					}
				}`,
				{ variables: { id: subscriptionId } }
			);
			const data = throwOnErrors(response);
			const end = data.node?.currentPeriodEnd ?? null;
			proAccessUntil = end ? new Date(end) : null;
		} catch (err) {
			console.error(`Could not read subscription period end for ${shop}:`, err);
		}
	}

	const updates: {
		billingActive: false;
		billingSubscriptionId: null;
		proAccessUntil?: Date | null;
	} = { billingActive: false, billingSubscriptionId: null };
	if (proAccessUntil !== undefined) updates.proAccessUntil = proAccessUntil;
	await db.update(shops).set(updates).where(eq(shops.shop, shop));
}

/**
 * Reconciles local billing state against Shopify's active subscriptions — the
 * source of truth — and stores the subscription ID. Returns whether the shop
 * has an active Pro subscription.
 *
 * Called from the app_subscriptions/update webhook, and as a fallback from the
 * billing API when the webhook was missed (e.g. delivered to another
 * environment during development).
 */
export async function syncBillingState(shop: string): Promise<boolean> {
	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		currentAppInstallation: {
			activeSubscriptions: Array<{ id: string; status: string }>;
		};
	}>(
		`#graphql
		query CartRadarSubscription {
			currentAppInstallation {
				activeSubscriptions {
					id
					status
				}
			}
		}`
	);

	const data = throwOnErrors(response);
	const subscription = data.currentAppInstallation.activeSubscriptions[0];

	if (!subscription) {
		await db
			.update(shops)
			.set({ billingActive: false, billingSubscriptionId: null })
			.where(eq(shops.shop, shop));
		return false;
	}

	// Active subscription → clear any leftover cancel-grace (they're paying again).
	await db
		.update(shops)
		.set({ billingActive: true, billingSubscriptionId: subscription.id, proAccessUntil: null })
		.where(eq(shops.shop, shop));
	return true;
}

export interface PlanState {
	plan: Plan;
	/** Alerts sent this calendar month (abandoned-cart events that fired). */
	alertsUsed: number;
	/** Monthly alert allowance, or null when unlimited (Pro). */
	limit: number | null;
	/** True when a Free shop has used its full monthly allowance. */
	limitReached: boolean;
	/** True only while a paying subscription is active (not during cancel grace). */
	subscriptionActive: boolean;
	/** When cancel-grace Pro ends (Pro until then), else null. */
	proUntil: Date | null;
}

/** Alerts (abandoned-cart events) the shop has fired in the current calendar month. */
async function countAlertsThisMonth(shop: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(checkouts)
		.where(
			and(eq(checkouts.shop, shop), sql`${checkouts.alertedAt} >= date_trunc('month', now())`)
		);
	return Number(row?.count ?? 0);
}

/**
 * Resolves the shop's plan and its current monthly alert usage. Pro shops are
 * unlimited; Free shops pause once they reach BILLING.freeAlertsPerMonth.
 */
export async function getPlanState(shop: string): Promise<PlanState> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	const alertsUsed = await countAlertsThisMonth(shop);

	const subscriptionActive = !!shopRow?.billingActive;
	const graceEnd = shopRow?.proAccessUntil ?? null;
	const inGrace = !subscriptionActive && !!graceEnd && graceEnd.getTime() > Date.now();

	if (subscriptionActive || inGrace) {
		return {
			plan: 'pro',
			alertsUsed,
			limit: null,
			limitReached: false,
			subscriptionActive,
			proUntil: inGrace ? graceEnd : null
		};
	}

	const limit = BILLING.freeAlertsPerMonth;
	return {
		plan: 'free',
		alertsUsed,
		limit,
		limitReached: alertsUsed >= limit,
		subscriptionActive: false,
		proUntil: null
	};
}
