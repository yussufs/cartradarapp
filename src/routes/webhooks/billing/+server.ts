import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { shops, type ShopPlan } from '$lib/shared/db/schema';
import type { AppSubscriptionWebhookPayload } from '$lib/types/shopify-webhooks';
import { PLAN_BY_SUBSCRIPTION_NAME } from '$lib/server/billing/plans';
import { syncUsageLineItemId } from '$lib/server/billing/subscriptions';

/** Handles app_subscriptions/update and app_subscriptions/approaching_capped_amount */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } =
		await authenticateWebhook<AppSubscriptionWebhookPayload>(request);

	try {
		const subscription = payload.app_subscription;

		if (topic === 'app_subscriptions/approaching_capped_amount') {
			// Merchant is at ~90% of their usage cap — surfaced as a banner in the app.
			// TODO(Phase 3): also email the merchant with a raise-cap link.
			console.log(`${shop} approaching usage cap on ${subscription.name}`);
			return new Response();
		}

		if (subscription.status === 'ACTIVE') {
			const plan: ShopPlan = PLAN_BY_SUBSCRIPTION_NAME[subscription.name] ?? 'pro';
			await db
				.update(shops)
				.set({
					plan,
					billingSubscriptionId: subscription.admin_graphql_api_id,
					// New billing cycle starts now — reset usage counters to match
					alertsUsedThisPeriod: 0,
					smsUsedThisPeriod: 0,
					domesticSmsUsedThisPeriod: 0,
					periodStartedAt: new Date()
				})
				.where(eq(shops.shop, shop));
			// Fetch the usage line item ID so SMS overage can be charged
			try {
				await syncUsageLineItemId(shop);
			} catch (err) {
				console.error(`Failed to sync usage line item for ${shop}:`, err);
			}
			console.log(`${shop} subscription active: ${subscription.name} → plan=${plan}`);
		} else if (['CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN'].includes(subscription.status)) {
			await db
				.update(shops)
				.set({ plan: 'free', billingSubscriptionId: null, usageLineItemId: null })
				.where(eq(shops.shop, shop));
			console.log(`${shop} subscription ${subscription.status} → downgraded to free`);
		}
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
