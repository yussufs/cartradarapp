import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { dispatchTestAlert } from '$lib/server/alerts/dispatch';

/** Sends a sample alert through the shop's saved channel configuration. */
export const POST: RequestHandler = async ({ request }) => {
	let shop: string;
	try {
		const { session } = await authenticateRequest(request);
		shop = session.shop;
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		return json(
			{ error: 'Unauthorized' },
			{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
		);
	}

	const result = await dispatchTestAlert(shop);
	return json(result);
};
