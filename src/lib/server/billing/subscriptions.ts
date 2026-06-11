/**
 * Shopify Billing: a single usage-based subscription ($0 recurring, one usage
 * line item) that the merchant approves once. Each recovered cart is billed as
 * a usage record — the 1% / $1-minimum success fee.
 */
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getOfflineSession } from '$lib/server/shopify/auth';
import { createAdmin, throwOnErrors, type AdminClient } from '$lib/server/shopify/graphql';
import { db } from '$lib/server/db';
import { shops, usageCharges } from '$lib/shared/db/schema';
import { BILLING, recoveryFeeUsd } from './plans';
import { adminAppUrl, formatMoney } from '$lib/server/alerts/format';

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
 * Creates the usage-based subscription and returns the confirmation URL the
 * merchant must approve. Activation lands via app_subscriptions/update.
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
							appUsagePricingDetails: {
								terms: `${(BILLING.feeRate * 100).toFixed(0)}% of each recovered cart's order value, $${BILLING.minFeeUsd.toFixed(2)} minimum per recovery. No monthly fee.`,
								cappedAmount: {
									amount: BILLING.defaultCappedAmountUsd.toFixed(2),
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

/** Cancels the active subscription (merchant opts out of billing). */
export async function cancelSubscription(shop: string): Promise<void> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	if (!shopRow?.billingSubscriptionId) return;

	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		appSubscriptionCancel: { userErrors: UserError[] };
	}>(
		`#graphql
		mutation CartRadarBillingCancel($id: ID!) {
			appSubscriptionCancel(id: $id) {
				userErrors { field message }
				appSubscription { id status }
			}
		}`,
		{ variables: { id: shopRow.billingSubscriptionId } }
	);

	const data = throwOnErrors(response);
	throwOnUserErrors(data.appSubscriptionCancel.userErrors, 'appSubscriptionCancel');
	// The app_subscriptions/update webhook flips billingActive off
}

/**
 * Reconciles local billing state against Shopify's active subscriptions —
 * the source of truth. Stores the subscription and usage line item IDs so
 * recovery fees can be billed. Returns whether billing is active.
 *
 * Called from the app_subscriptions/update webhook, and as a fallback from
 * the billing API when the webhook was missed (e.g. delivered to another
 * environment during development).
 */
export async function syncBillingState(shop: string): Promise<boolean> {
	const admin = await getOfflineAdmin(shop);
	const response = await admin.graphql<{
		currentAppInstallation: {
			activeSubscriptions: Array<{
				id: string;
				lineItems: Array<{ id: string; plan: { pricingDetails: { __typename: string } } }>;
			}>;
		};
	}>(
		`#graphql
		query CartRadarUsageLineItem {
			currentAppInstallation {
				activeSubscriptions {
					id
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

	if (!subscription) {
		await db
			.update(shops)
			.set({ billingActive: false, billingSubscriptionId: null, usageLineItemId: null })
			.where(eq(shops.shop, shop));
		return false;
	}

	const usageLineItem = subscription.lineItems.find(
		(item) => item.plan.pricingDetails.__typename === 'AppUsagePricing'
	);

	await db
		.update(shops)
		.set({
			billingActive: true,
			billingSubscriptionId: subscription.id,
			usageLineItemId: usageLineItem?.id ?? null
		})
		.where(eq(shops.shop, shop));
	return true;
}

/**
 * Bills the success fee for a recovered cart. Always writes the audit row; pushes
 * a Shopify usage record when billing is active. A cap-exceeded error is logged
 * but never blocks recovery tracking. Idempotent per recovered checkout.
 */
export async function chargeRecovery(
	shop: string,
	checkoutId: string,
	orderId: string,
	recoveredAmount: string | null,
	currency: string
): Promise<void> {
	const orderTotal = parseFloat(recoveredAmount ?? '0');
	const amount = recoveryFeeUsd(orderTotal).toFixed(2);
	const idempotencyKey = `recovery-${checkoutId}`;

	const inserted = await db
		.insert(usageCharges)
		.values({ shop, checkoutId, orderId, recoveredAmount, amount, idempotencyKey })
		.onConflictDoNothing()
		.returning({ id: usageCharges.id });
	if (inserted.length === 0) return; // already billed for this recovery

	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	if (!shopRow?.billingActive || !shopRow.usageLineItemId) {
		console.warn(`Billing inactive for ${shop}; recovery fee $${amount} recorded but not charged`);
		return;
	}

	try {
		const admin = await getOfflineAdmin(shop);
		const recovered = formatMoney(orderTotal, currency);
		const response = await admin.graphql<{
			appUsageRecordCreate: { userErrors: UserError[]; appUsageRecord: { id: string } | null };
		}>(
			`#graphql
			mutation CartRadarRecoveryCharge(
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
					description: `Recovery fee — ${recovered} cart recovered (order ${orderId})`,
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
		// Most likely the usage cap was reached — recovery is already tracked, so just log
		console.error(`Failed to push recovery fee for ${shop}:`, err);
	}
}
