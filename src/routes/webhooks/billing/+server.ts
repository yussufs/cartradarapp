import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import type { AppSubscriptionWebhookPayload } from '$lib/types/shopify-webhooks';
import { recordCancellation, syncBillingState } from '$lib/server/billing/subscriptions';

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
		} else if (subscription.status === 'CANCELLED') {
			// Voluntary cancel (our button OR Shopify admin) — keep Pro until the
			// paid period ends, then fall to Free.
			await recordCancellation(shop, subscription.admin_graphql_api_id);
			console.log(`${shop} Pro subscription cancelled → Pro until period end`);
		} else if (['DECLINED', 'EXPIRED', 'FROZEN'].includes(subscription.status)) {
			// Not a paid cancellation (declined approval, expired, or payment frozen)
			// — drop to Free immediately, no grace.
			await db
				.update(shops)
				.set({ billingActive: false, billingSubscriptionId: null, proAccessUntil: null })
				.where(eq(shops.shop, shop));
			console.log(`${shop} Pro subscription ${subscription.status} → Free`);
		}
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
