import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { addRecipient, listRecipients, RecipientError } from '$lib/server/recipients';
import type { RecipientChannel } from '$lib/shared/db/schema';

async function shopFromRequest(request: Request) {
	try {
		const { session } = await authenticateRequest(request);
		return { shop: session.shop, response: null };
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		if (status === 500) console.error('Unexpected auth error on /api/recipients:', err);
		return {
			shop: null,
			response: json(
				{ error: 'Unauthorized' },
				{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
			)
		};
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;
	return json({ recipients: await listRecipients(shop) });
};

export const POST: RequestHandler = async ({ request }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;

	let body: { channel?: string; destination?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (body.channel !== 'email') {
		return json({ error: 'Unknown channel' }, { status: 422 });
	}
	if (!body.destination?.trim()) {
		return json({ error: 'A destination is required' }, { status: 422 });
	}

	try {
		const recipient = await addRecipient(shop, body.channel as RecipientChannel, body.destination);
		return json({ recipient });
	} catch (err) {
		if (err instanceof RecipientError) return json({ error: err.message }, { status: err.status });
		console.error('Failed to add recipient:', err);
		return json(
			{ error: 'Could not send a verification code. Please try again.' },
			{ status: 500 }
		);
	}
};
