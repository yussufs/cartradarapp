import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import type { AppSubscriptionWebhookPayload } from '$lib/types/shopify-webhooks';
import { syncBillingState } from '$lib/server/billing/subscriptions';

/** Handles app_subscriptions/update — flips the Pro subscription on or off. */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } =
		await authenticateWebhook<AppSubscriptionWebhookPayload>(request);

	try {
		const subscription = payload.app_subscription;

		if (subscription.status === 'ACTIVE') {
			// Pull the subscription ID from Shopify and flip billingActive on
			await syncBillingState(shop);
			console.log(`${shop} Pro subscription active`);
		} else if (['CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN'].includes(subscription.status)) {
			await db
				.update(shops)
				.set({ billingActive: false, billingSubscriptionId: null })
				.where(eq(shops.shop, shop));
			console.log(`${shop} Pro subscription ${subscription.status} → Free`);
		}
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
