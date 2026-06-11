import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import {
	removeRecipient,
	resendCode,
	verifyRecipient,
	RecipientError
} from '$lib/server/recipients';

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

/** Verify a recipient with its one-time code. */
export const PATCH: RequestHandler = async ({ request, params }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;

	let body: { code?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	if (!body.code?.trim()) return json({ error: 'Enter the code we sent you' }, { status: 422 });

	try {
		const recipient = await verifyRecipient(shop, params.id, body.code);
		return json({ recipient });
	} catch (err) {
		if (err instanceof RecipientError) return json({ error: err.message }, { status: err.status });
		console.error('Failed to verify recipient:', err);
		return json({ error: 'Verification failed. Please try again.' }, { status: 500 });
	}
};

/** Resend a fresh verification code. */
export const POST: RequestHandler = async ({ request, params }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;

	try {
		const recipient = await resendCode(shop, params.id);
		return json({ recipient });
	} catch (err) {
		if (err instanceof RecipientError) return json({ error: err.message }, { status: err.status });
		console.error('Failed to resend code:', err);
		return json({ error: 'Could not resend the code. Please try again.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const { shop, response } = await shopFromRequest(request);
	if (!shop) return response!;
	await removeRecipient(shop, params.id);
	return json({ ok: true });
};
