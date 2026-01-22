import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { getOfflineSessionId } from '$lib/server/shopify';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/shared/db/schema';
import { eq } from 'drizzle-orm';

interface ScopesUpdatePayload {
	current: string[];
	previous: string[];
}

export const POST: RequestHandler = async ({ request }) => {
	const { shop, payload } = await authenticateWebhook<ScopesUpdatePayload>(request);

	try {
		const currentScopes = payload.current.join(',');
		const sessionId = getOfflineSessionId(shop);

		await db
			.update(sessionTable)
			.set({ scope: currentScopes })
			.where(eq(sessionTable.id, sessionId));

		console.log(`Updated scopes for ${shop}: ${currentScopes}`);
	} catch (err) {
		console.error('Error processing app/scopes_update webhook:', err);
	}

	return new Response();
};
