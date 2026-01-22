import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { shopify } from '$lib/server/shopify';
import crypto from 'crypto';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const shop = url.searchParams.get('shop');

	if (!shop) {
		redirect(302, '/auth/login');
	}

	// Generate state for CSRF protection
	const state = crypto.randomBytes(16).toString('hex');

	// Store state in cookie
	cookies.set('shopify_app_state', state, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'none',
		maxAge: 60 * 10
	});

	// Build OAuth URL
	const config = shopify.api.config;
	const scopes = config.scopes?.toString() || '';
	const hostName = config.hostName;
	const redirectUri = `https://${hostName}/auth/callback`;

	const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
	authUrl.searchParams.set('client_id', config.apiKey);
	authUrl.searchParams.set('scope', scopes);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('state', state);

	redirect(302, authUrl.toString());
};
