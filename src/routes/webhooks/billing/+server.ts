import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import type { AppSubscriptionWebhookPayload } from '$lib/types/shopify-webhooks';
import { syncBillingState } from '$lib/server/billing/subscriptions';

/** Handles app_subscriptions/update and app_subscriptions/approaching_capped_amount */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } =
		await authenticateWebhook<AppSubscriptionWebhookPayload>(request);

	try {
		const subscription = payload.app_subscription;

		if (topic === 'app_subscriptions/approaching_capped_amount') {
			// Merchant is at ~90% of their usage cap — surfaced as a banner in the app.
			console.log(`${shop} approaching usage cap on ${subscription.name}`);
			return new Response();
		}

		if (subscription.status === 'ACTIVE') {
			// Pull subscription + usage line item IDs from Shopify and flip billingActive
			await syncBillingState(shop);
			console.log(`${shop} billing active`);
		} else if (['CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN'].includes(subscription.status)) {
			await db
				.update(shops)
				.set({ billingActive: false, billingSubscriptionId: null, usageLineItemId: null })
				.where(eq(shops.shop, shop));
			console.log(`${shop} billing ${subscription.status} → inactive`);
		}
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
