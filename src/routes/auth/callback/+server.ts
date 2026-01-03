import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { shopify, Session } from '$lib/server/shopify';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const shop = url.searchParams.get('shop');
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const host = url.searchParams.get('host');

	// Validate required parameters
	if (!shop || !code || !state) {
		error(400, 'Missing required OAuth parameters');
	}

	// Verify state matches cookie (CSRF protection)
	const storedState = cookies.get('shopify_app_state');
	if (!storedState || storedState !== state) {
		error(400, 'Invalid state parameter');
	}

	// Clear state cookie
	cookies.delete('shopify_app_state', { path: '/' });

	try {
		const config = shopify.api.config;

		// Exchange authorization code for access token
		const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_id: config.apiKey,
				client_secret: config.apiSecretKey,
				code
			})
		});

		if (!tokenResponse.ok) {
			console.error('Token exchange failed:', await tokenResponse.text());
			error(400, 'Failed to exchange authorization code');
		}

		const tokenData = (await tokenResponse.json()) as {
			access_token: string;
			scope: string;
		};

		// Create and store session
		const sessionId = shopify.api.session.getOfflineId(shop);
		const session = new Session({
			id: sessionId,
			shop,
			state,
			isOnline: false,
			accessToken: tokenData.access_token,
			scope: tokenData.scope
		});

		await shopify.sessionStorage.storeSession(session);

		// Use the SHOPIFY_APP_URL env var directly for redirect
		const { env } = await import('$env/dynamic/private');
		const appUrl = env.SHOPIFY_APP_URL || env.HOST || `https://${config.hostName}`;

		// Redirect to app page with shop and host params
		const redirectUrl = new URL('/app', appUrl);
		redirectUrl.searchParams.set('shop', shop);
		if (host) {
			redirectUrl.searchParams.set('host', host);
		}

		redirect(302, redirectUrl.toString());
	} catch (err) {
		// Re-throw SvelteKit redirects and errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('OAuth callback error:', err);
		redirect(302, `/auth/login?error=${encodeURIComponent('OAuth failed. Please try again.')}`);
	}
};
