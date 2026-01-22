import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/shared/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const { shop } = await authenticateWebhook(request);

	try {
		await db.delete(sessionTable).where(eq(sessionTable.shop, shop));
		console.log(`Deleted sessions for ${shop}`);
	} catch (err) {
		console.error('Error processing app/uninstalled webhook:', err);
	}

	return new Response();
};
