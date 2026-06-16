/**
 * Slack connection control (authenticated). `connect` returns the Slack OAuth
 * URL for the client to open top-level; `disconnect` clears the stored webhook.
 * The OAuth callback that actually stores the webhook is /auth/slack/callback.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { channelSettings } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { buildAuthorizeUrl, isSlackConfigured } from '$lib/server/slack/oauth';

async function authenticate(request: Request) {
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

export const POST: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	let body: { action?: string; returnTo?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (body.action === 'connect') {
		if (!isSlackConfigured()) {
			return json({ error: 'Slack is not configured on the server' }, { status: 503 });
		}
		// returnTo is validated against an allowlist inside buildAuthorizeUrl.
		return json({ url: buildAuthorizeUrl(shop, body.returnTo ?? '/app/settings') });
	}

	if (body.action === 'disconnect') {
		await ensureShopRow(shop);
		const cleared = {
			slackEnabled: false,
			slackWebhookUrl: null,
			slackChannelName: null,
			updatedAt: new Date()
		};
		await db
			.insert(channelSettings)
			.values({ shop, ...cleared })
			.onConflictDoUpdate({ target: channelSettings.shop, set: cleared });
		return json({ ok: true });
	}

	return json({ error: 'Unknown action' }, { status: 422 });
};
