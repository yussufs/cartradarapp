import type { RequestHandler } from './$types';
import { shopify, getOfflineSessionId } from '$lib/server/shopify';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();

	try {
		// Validate webhook signature
		const valid = await shopify.api.webhooks.validate({
			rawBody,
			rawRequest: request
		});

		if (!valid) {
			console.error('Invalid webhook signature');
			return new Response('Unauthorized', { status: 401 });
		}
	} catch (err) {
		console.error('Webhook validation error:', err);
		return new Response('Unauthorized', { status: 401 });
	}

	// Extract shop from headers
	const shop = request.headers.get('x-shopify-shop-domain');
	const topic = request.headers.get('x-shopify-topic');

	console.log(`Received ${topic} webhook for ${shop}`);

	if (shop) {
		try {
			const payload = JSON.parse(rawBody);
			const currentScopes = (payload.current as string[]).join(',');

			// Update the session scopes
			const sessionId = getOfflineSessionId(shop);

			await db
				.update(sessionTable)
				.set({ scope: currentScopes })
				.where(eq(sessionTable.id, sessionId));

			console.log(`Updated scopes for ${shop}: ${currentScopes}`);
		} catch (err) {
			console.error('Error updating scopes:', err);
		}
	}

	return new Response('OK', { status: 200 });
};
