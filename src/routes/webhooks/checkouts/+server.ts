import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { upsertCheckoutFromWebhook } from '$lib/server/checkouts';
import type { CheckoutWebhookPayload } from '$lib/types/shopify-webhooks';

/** Handles checkouts/create and checkouts/update */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } = await authenticateWebhook<CheckoutWebhookPayload>(request);

	try {
		await upsertCheckoutFromWebhook(shop, payload);
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
