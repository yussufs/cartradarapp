import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { markCheckoutOrdered } from '$lib/server/checkouts';
import type { OrderWebhookPayload } from '$lib/types/shopify-webhooks';

/** Handles orders/create — detects completed/recovered checkouts */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } = await authenticateWebhook<OrderWebhookPayload>(request);

	try {
		await markCheckoutOrdered(shop, payload);
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
