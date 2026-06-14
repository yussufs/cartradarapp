import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { removeRecipient, resendVerification, RecipientError } from '$lib/server/recipients';

async function shopFromRequest(request: Request) {
	try {
		const { session } = await authenticateRequest(request);
		return { shop: session.shop, response: null };
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		return {
			shop: null,
			response: json(
				{ error: 'Unauthorized' },
				{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
			)
		};
	}
}

/** Resend a fresh confirmation link. */
export const POST: RequestHandler = async ({ request, params }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;

	try {
		const recipient = await resendVerification(shop, params.id);
		return json({ recipient });
	} catch (err) {
		if (err instanceof RecipientError) return json({ error: err.message }, { status: err.status });
		console.error('Failed to resend confirmation link:', err);
		return json({ error: 'Could not resend the link. Please try again.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;
	await removeRecipient(shop, params.id);
	return json({ ok: true });
};
