import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { markDraftOrderCompleted } from '$lib/server/draft-orders';
import type { DraftOrderWebhookPayload } from '$lib/types/shopify-webhooks';

/** Handles draft_orders/update — attributes completed Cart Radar draft orders */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } = await authenticateWebhook<DraftOrderWebhookPayload>(request);

	try {
		await markDraftOrderCompleted(shop, payload);
	} catch (err) {
		console.error(`Error processing ${topic} webhook for ${shop}:`, err);
	}

	return new Response();
};
