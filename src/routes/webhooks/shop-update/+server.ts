import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import type { ShopUpdateWebhookPayload } from '$lib/types/shopify-webhooks';

/** Handles shop/update — keeps shop name/currency in sync */
export const POST: RequestHandler = async ({ request }) => {
	const { shop, payload } = await authenticateWebhook<ShopUpdateWebhookPayload>(request);

	try {
		await db
			.update(shops)
			.set({ shopName: payload.name ?? null, currency: payload.currency ?? null })
			.where(eq(shops.shop, shop));
	} catch (err) {
		console.error(`Error processing shop/update webhook for ${shop}:`, err);
	}

	return new Response();
};
