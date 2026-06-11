import type { RequestEvent } from '@sveltejs/kit';
import { shopify, getOfflineSessionId, Session } from '$lib/server/shopify';
import { createAdmin, type AdminClient } from '$lib/server/shopify/graphql';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';

export interface AuthResult {
	session: Session;
	admin: AdminClient;
}

/**
 * Authenticate a request using a session token.
 * Accepts the token from either the Authorization header (Bearer) or directly.
 * If no offline session exists (or scopes are insufficient), performs token exchange
 * to obtain an offline access token from Shopify.
 */
export async function authenticateRequest(request: Request, idToken?: string): Promise<AuthResult> {
	let token = idToken;

	if (!token) {
		const authHeader = request.headers.get('authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			throw new AuthError('missing_token', 'No session token available');
		}
		token = authHeader.substring(7);
	}
	const payload = await shopify.api.session.decodeSessionToken(token);
	const shop = payload.dest.replace('https://', '');
	const sessionId = getOfflineSessionId(shop);

	// Try to load existing session
	let session = await shopify.sessionStorage.loadSession(sessionId);

	// Check if session exists with valid scopes
	if (session?.accessToken) {
		const requiredScopes = shopify.api.config.scopes;
		if (requiredScopes && session.scope) {
			const sessionScopes = session.scope.split(',').map((s: string) => s.trim());
			const requiredScopesArray = requiredScopes.toArray();
			const hasScopes = requiredScopesArray.every((scope: string) => sessionScopes.includes(scope));
			if (!hasScopes) {
				// Insufficient scopes — force token exchange
				session = undefined;
			}
		}
	} else {
		session = undefined;
	}

	// No valid session — perform token exchange (this is install / re-auth)
	if (!session) {
		session = await performTokenExchange(shop, token, sessionId);
		await captureShopProfile(session);
	}

	const admin = createAdmin(session);
	return { session, admin };
}

/**
 * Capture the store's base currency and name at install / re-auth so the
 * settings UI shows the right currency from the first visit.
 * Best-effort: a failure here must never block authentication.
 */
async function captureShopProfile(session: Session): Promise<void> {
	try {
		const admin = createAdmin(session);
		const response = await admin.graphql<{ shop: { name: string; currencyCode: string } }>(
			`#graphql
			query CartRadarShopProfile {
				shop {
					name
					currencyCode
				}
			}`
		);
		const shopData = response.data?.shop;
		if (!shopData) return;

		await db
			.insert(shops)
			.values({ shop: session.shop, shopName: shopData.name, currency: shopData.currencyCode })
			.onConflictDoUpdate({
				target: shops.shop,
				set: { shopName: shopData.name, currency: shopData.currencyCode }
			});
	} catch (err) {
		console.error(`Failed to capture shop profile for ${session.shop}:`, err);
	}
}

/**
 * Perform Shopify token exchange to obtain an offline access token.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
 */
async function performTokenExchange(
	shop: string,
	sessionToken: string,
	sessionId: string
): Promise<Session> {
	const config = shopify.api.config;

	console.log(`Token exchange: requesting offline access token for ${shop}`);

	const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: new URLSearchParams({
			client_id: config.apiKey,
			client_secret: config.apiSecretKey,
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			subject_token: sessionToken,
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token'
		})
	});

	if (!response.ok) {
		const body = await response.text();
		console.error('Token exchange failed:', response.status, body);
		throw new AuthError('token_exchange_failed', `Token exchange failed: ${response.status}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		scope: string;
	};

	const session = new Session({
		id: sessionId,
		shop,
		state: '',
		isOnline: false,
		accessToken: data.access_token,
		scope: data.scope
	});

	await shopify.sessionStorage.storeSession(session);
	console.log(`Token exchange: stored offline session for ${shop}`);

	return session;
}

/**
 * Extract shop domain from request query params or host param.
 */
export function getShopFromRequest(event: RequestEvent): string | null {
	const shop = event.url.searchParams.get('shop');
	if (shop) return shop;

	const host = event.url.searchParams.get('host');
	if (host) {
		try {
			const decoded = atob(host);
			const match = decoded.match(/([^/]+\.myshopify\.com)/);
			if (match) return match[1];
		} catch {
			// Invalid base64
		}
	}

	return null;
}

export class AuthError extends Error {
	constructor(
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'AuthError';
	}
}
