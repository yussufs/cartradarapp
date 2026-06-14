import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import {
	createDraftOrderFromCheckout,
	draftOrderAdminUrl,
	DraftOrderError
} from '$lib/server/draft-orders';

/** Creates a draft order in Shopify from an abandoned cart's contents. */
export const POST: RequestHandler = async ({ request, params }) => {
	let shop: string;
	let admin;
	try {
		({
			admin,
			session: { shop }
		} = await authenticateRequest(request));
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		return json(
			{ error: 'Unauthorized' },
			{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
		);
	}

	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	try {
		const draftOrder = await createDraftOrderFromCheckout(admin, shop, params.id);
		return json({
			draftOrder: {
				...draftOrder,
				adminUrl: draftOrderAdminUrl(shop, draftOrder.id)
			}
		});
	} catch (err) {
		if (err instanceof DraftOrderError) {
			const status = err.code === 'not_found' ? 404 : 422;
			return json({ error: err.message }, { status });
		}
		console.error(`Draft order creation failed for ${shop}:`, err);
		return json({ error: 'Could not create the draft order. Please try again.' }, { status: 500 });
	}
};
