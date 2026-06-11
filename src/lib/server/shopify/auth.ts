import type { RequestEvent } from '@sveltejs/kit';
import { RequestedTokenType } from '@shopify/shopify-api';
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
	const isNewInstall = !session;

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
		// Legacy non-expiring tokens are rejected by Shopify; expired tokens need
		// a refresh. Either way, a fresh token exchange mints a valid session.
		if (session && (!session.refreshToken || session.isExpired(EXPIRY_BUFFER_MS))) {
			session = undefined;
		}
	} else {
		session = undefined;
	}

	// No valid session — perform token exchange (install, re-auth, or token expiry)
	if (!session) {
		session = await performTokenExchange(shop, token);
		if (isNewInstall) await captureShopProfile(session);
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
 * Perform Shopify token exchange to obtain an expiring offline access token.
 * Shopify no longer accepts non-expiring tokens on the Admin API, so the
 * resulting session carries expires + refreshToken for later renewal.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
 */
async function performTokenExchange(shop: string, sessionToken: string): Promise<Session> {
	try {
		const { session } = await shopify.api.auth.tokenExchange({
			shop,
			sessionToken,
			requestedTokenType: RequestedTokenType.OfflineAccessToken,
			expiring: true
		});
		await shopify.sessionStorage.storeSession(session);
		console.log(
			`Token exchange: stored offline session for ${shop} (expires ${session.expires?.toISOString()})`
		);
		return session;
	} catch (err) {
		console.error(`Token exchange failed for ${shop}:`, err);
		throw new AuthError('token_exchange_failed', 'Token exchange failed');
	}
}

/** Refresh this far before the access token actually expires (clock skew, latency). */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Load a usable offline session for background work (webhooks, billing) where
 * no App Bridge id_token is available. Refreshes the access token when it is
 * expired or about to expire, and migrates legacy non-expiring tokens in place.
 */
export async function getOfflineSession(shop: string): Promise<Session> {
	const session = await shopify.sessionStorage.loadSession(getOfflineSessionId(shop));
	if (!session?.accessToken) {
		throw new AuthError('no_session', `No offline session for ${shop}`);
	}

	// Legacy non-expiring token: one-time, in-place migration to an expiring one.
	if (!session.refreshToken && !session.expires) {
		const { session: migrated } = await shopify.api.auth.migrateToExpiringToken({
			shop,
			nonExpiringOfflineAccessToken: session.accessToken
		});
		await shopify.sessionStorage.storeSession(migrated);
		console.log(`Migrated ${shop} to an expiring offline token`);
		return migrated;
	}

	if (!session.isExpired(EXPIRY_BUFFER_MS)) {
		return session;
	}

	if (
		!session.refreshToken ||
		(session.refreshTokenExpires && session.refreshTokenExpires < new Date())
	) {
		throw new AuthError(
			'refresh_token_expired',
			`Offline token for ${shop} expired and cannot be refreshed; the merchant must reopen the app`
		);
	}

	const { session: refreshed } = await shopify.api.auth.refreshToken({
		shop,
		refreshToken: session.refreshToken
	});
	await shopify.sessionStorage.storeSession(refreshed);
	return refreshed;
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
