/**
 * Shopify Billing API integration: subscription create/cancel, usage records,
 * and syncing the usage line item ID after a subscription activates.
 */
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { shopify, getOfflineSessionId } from '$lib/server/shopify';
import { createAdmin, throwOnErrors, type AdminClient } from '$lib/server/shopify/graphql';
import { db } from '$lib/server/db';
import { shops, usageCharges, type ShopPlan } from '$lib/shared/db/schema';
import { PLANS } from './plans';
import { adminAppUrl } from '$lib/server/alerts/format';

async function getOfflineAdmin(shop: string): Promise<AdminClient> {
	const session = await shopify.sessionStorage.loadSession(getOfflineSessionId(shop));
	if (!session) throw new Error(`No offline session for ${shop}`);
	return createAdmin(session);
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
 * Creates a Pro/Scale subscription (recurring + SMS usage line item) and
 * returns the confirmation URL the merchant must approve.
 * Activation lands via the app_subscriptions/update webhook.
 */
export async function createSubscription(shop: string, plan: ShopPlan): Promise<string> {
	const definition = PLANS[plan];
	if (!definition.subscriptionName || definition.smsPricing === null) {
		throw new Error(`Plan ${plan} has no paid subscription`);
	}
	const smsPricing = definition.smsPricing;

	const admin = await getOfflineAdmin(shop);

	const response = await admin.graphql<{
		appSubscriptionCreate: {
			userErrors: UserError[];
			confirmationUrl: string | null;
		};
	}>(
		`#graphql
		mutation CartRadarSubscriptionCreate(
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
				name: definition.subscriptionName,
				returnUrl: adminAppUrl(shop, '/app/billing'),
				test: env.BILLING_TEST_MODE === 'true',
				lineItems: [
					{
						plan: {
							appRecurringPricingDetails: {
								// MoneyInput.amount is a Decimal scalar — serialize as a string
								price: { amount: definition.monthlyPriceUsd.toFixed(2), currencyCode: 'USD' },
								interval: 'EVERY_30_DAYS'
							}
						}
					},
					{
						plan: {
							appUsagePricingDetails: {
								terms: `${definition.includedSms} US/Canada SMS alerts included each 30 days, then $${smsPricing.domestic.toFixed(2)} each. International SMS $${smsPricing.international.toFixed(2)} each.`,
								cappedAmount: {
									amount: definition.defaultCappedAmountUsd.toFixed(2),
									currencyCode: 'USD'
								}
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

/** Cancels the active subscription (merchant downgrades to free). */
export async function cancelSubscription(shop: string): Promise<void> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	if (!shopRow?.billingSubscriptionId) return;

	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		appSubscriptionCancel: { userErrors: UserError[] };
	}>(
		`#graphql
		mutation CartRadarSubscriptionCancel($id: ID!) {
			appSubscriptionCancel(id: $id) {
				userErrors { field message }
				appSubscription { id status }
			}
		}`,
		{ variables: { id: shopRow.billingSubscriptionId } }
	);

	const data = throwOnErrors(response);
	throwOnUserErrors(data.appSubscriptionCancel.userErrors, 'appSubscriptionCancel');
	// The app_subscriptions/update webhook downgrades the shop row to free
}

/**
 * After a subscription activates, look up its usage line item ID and store it
 * so SMS overage can be charged via appUsageRecordCreate.
 */
export async function syncUsageLineItemId(shop: string): Promise<void> {
	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		currentAppInstallation: {
			activeSubscriptions: Array<{
				id: string;
				name: string;
				lineItems: Array<{ id: string; plan: { pricingDetails: { __typename: string } } }>;
			}>;
		};
	}>(
		`#graphql
		query CartRadarActiveSubscriptions {
			currentAppInstallation {
				activeSubscriptions {
					id
					name
					lineItems {
						id
						plan { pricingDetails { __typename } }
					}
				}
			}
		}`
	);

	const data = throwOnErrors(response);
	const subscription = data.currentAppInstallation.activeSubscriptions[0];
	if (!subscription) return;

	const usageLineItem = subscription.lineItems.find(
		(item) => item.plan.pricingDetails.__typename === 'AppUsagePricing'
	);

	await db
		.update(shops)
		.set({
			billingSubscriptionId: subscription.id,
			usageLineItemId: usageLineItem?.id ?? null
		})
		.where(eq(shops.shop, shop));
}

/**
 * Records SMS overage: writes the audit row, then pushes a usage record to
 * Shopify. A cap-exceeded error is logged but never blocks the alert itself.
 */
export async function recordSmsOverage(
	shop: string,
	checkoutId: string,
	amount: string,
	description: string
): Promise<void> {
	const idempotencyKey = `sms-overage-${checkoutId}`;

	const inserted = await db
		.insert(usageCharges)
		.values({ shop, amount, idempotencyKey })
		.onConflictDoNothing()
		.returning({ id: usageCharges.id });
	if (inserted.length === 0) return; // already charged for this checkout

	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	if (!shopRow?.usageLineItemId) {
		console.warn(
			`No usage line item for ${shop}; SMS overage of $${amount} recorded but not charged`
		);
		return;
	}

	try {
		const admin = await getOfflineAdmin(shop);
		const response = await admin.graphql<{
			appUsageRecordCreate: {
				userErrors: UserError[];
				appUsageRecord: { id: string } | null;
			};
		}>(
			`#graphql
			mutation CartRadarUsageRecordCreate(
				$subscriptionLineItemId: ID!
				$price: MoneyInput!
				$description: String!
				$idempotencyKey: String!
			) {
				appUsageRecordCreate(
					subscriptionLineItemId: $subscriptionLineItemId
					price: $price
					description: $description
					idempotencyKey: $idempotencyKey
				) {
					userErrors { field message }
					appUsageRecord { id }
				}
			}`,
			{
				variables: {
					subscriptionLineItemId: shopRow.usageLineItemId,
					price: { amount, currencyCode: 'USD' },
					description,
					idempotencyKey
				}
			}
		);

		const data = throwOnErrors(response);
		throwOnUserErrors(data.appUsageRecordCreate.userErrors, 'appUsageRecordCreate');

		if (data.appUsageRecordCreate.appUsageRecord) {
			await db
				.update(usageCharges)
				.set({ shopifyUsageRecordId: data.appUsageRecordCreate.appUsageRecord.id })
				.where(eq(usageCharges.id, inserted[0].id));
		}
	} catch (err) {
		// Most likely the usage cap was reached — alert already went out, so just log
		console.error(`Failed to push usage record for ${shop}:`, err);
	}
}
