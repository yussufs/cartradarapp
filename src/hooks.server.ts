import type { Handle, RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { shopify, getOfflineSessionId } from '$lib/server/shopify';
import { createAdmin } from '$lib/server/shopify/graphql';

export const handle: Handle = async ({ event, resolve }) => {
	const { url } = event;

	// Skip auth for public routes
	if (isPublicRoute(url.pathname)) {
		return resolve(event);
	}

	// Handle /app/* routes (embedded app pages)
	if (url.pathname.startsWith('/app')) {
		const authenticated = await authenticateAdmin(event);

		if (!authenticated) {
			// For embedded apps, redirect to OAuth
			const shop = getShopFromRequest(event);
			if (shop) {
				redirect(302, `/auth?shop=${encodeURIComponent(shop)}`);
			}
			redirect(302, '/auth/login');
		}
	}

	return resolve(event);
};

function isPublicRoute(pathname: string): boolean {
	const publicRoutes = ['/auth', '/api/auth', '/webhooks', '/'];

	// Check exact matches and prefix matches
	return publicRoutes.some(
		(route) => pathname === route || (route !== '/' && pathname.startsWith(route + '/'))
	);
}

async function authenticateAdmin(event: RequestEvent): Promise<boolean> {
	try {
		// For embedded apps, check for session token in Authorization header
		const authHeader = event.request.headers.get('authorization');

		if (authHeader?.startsWith('Bearer ')) {
			const token = authHeader.substring(7);

			try {
				// Decode and validate the session token
				const payload = await shopify.api.session.decodeSessionToken(token);

				// Get the offline session for this shop
				const shop = payload.dest.replace('https://', '');
				const sessionId = getOfflineSessionId(shop);
				const session = await shopify.sessionStorage.loadSession(sessionId);

				if (session && session.accessToken) {
					// Check if session has required scopes
					const requiredScopes = shopify.api.config.scopes;
					if (requiredScopes && session.scope) {
						const sessionScopes = session.scope.split(',').map((s: string) => s.trim());
						const requiredScopesArray = requiredScopes.toArray();
						const hasScopes = requiredScopesArray.every((scope: string) =>
							sessionScopes.includes(scope)
						);
						if (!hasScopes) {
							return false;
						}
					}

					// Create admin client and attach to locals
					const admin = createAdmin(session);
					event.locals.shopify = { session, admin };
					return true;
				}
			} catch (tokenError) {
				console.error('Session token validation failed:', tokenError);
			}
		}

		// Fallback: Check for shop in query params (initial load from Shopify Admin)
		const shop = getShopFromRequest(event);
		if (shop) {
			const sessionId = getOfflineSessionId(shop);
			const session = await shopify.sessionStorage.loadSession(sessionId);

			if (session && session.accessToken) {
				const admin = createAdmin(session);
				event.locals.shopify = { session, admin };
				return true;
			}
		}

		return false;
	} catch (err) {
		console.error('Authentication error:', err);
		return false;
	}
}

function getShopFromRequest(event: RequestEvent): string | null {
	// Check query params first
	const shop = event.url.searchParams.get('shop');
	if (shop) return shop;

	// Check for host param (Shopify embeds this in iframes)
	const host = event.url.searchParams.get('host');
	if (host) {
		try {
			const decoded = atob(host);
			const match = decoded.match(/([^/]+\.myshopify\.com)/);
			if (match) return match[1];
		} catch {
			// Invalid base64, ignore
		}
	}

	return null;
}
