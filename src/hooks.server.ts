import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { authenticateRequest, getShopFromRequest, AuthError } from '$lib/server/shopify/auth';
import { shopify } from '$lib/server/shopify';
import { startScheduler } from '$lib/server/jobs/scheduler';

const RETRY_HEADER = 'X-Shopify-Retry-Invalid-Session-Request';

// Abandonment evaluator — guard against duplicate timers across dev HMR reloads
const globals = globalThis as { __cartRadarSchedulerStarted?: boolean };
if (!building && !globals.__cartRadarSchedulerStarted) {
	globals.__cartRadarSchedulerStarted = true;
	startScheduler();
}

export const handle: Handle = async ({ event, resolve }) => {
	const { url } = event;

	// Skip auth for public routes
	if (isPublicRoute(url.pathname)) {
		return resolve(event);
	}

	// Handle /app/* routes (embedded app pages)
	if (url.pathname.startsWith('/app')) {
		const authHeader = event.request.headers.get('authorization');

		// Get token from either Authorization header (XHR) or id_token query param (initial load)
		const idToken = url.searchParams.get('id_token');

		if (authHeader?.startsWith('Bearer ') || idToken) {
			try {
				const { session, admin } = await authenticateRequest(event.request, idToken || undefined);
				event.locals.shopify = { session, admin };
			} catch (err) {
				// A stale/expired App Bridge session token is expected and self-healing:
				// XHRs retry via the header below; document loads fall through and App
				// Bridge re-bootstraps. Log it quietly so genuine auth failures stand out.
				if (err instanceof Error && err.name === 'InvalidJwtError') {
					console.warn(
						`Stale session token (${authHeader ? 'XHR — will retry' : 'document — App Bridge will re-bootstrap'})`
					);
				} else {
					console.error('Auth failed:', err);
				}
				// Only return 401 for XHR requests (with Authorization header)
				// Document requests should fall through to render the page with App Bridge
				if (authHeader) {
					return new Response(JSON.stringify({ error: 'Unauthorized' }), {
						status: 401,
						headers: {
							'Content-Type': 'application/json',
							[RETRY_HEADER]: '1'
						}
					});
				}
			}
		}
		// Document requests without a token pass through to SvelteKit normally.
		// The layout loads App Bridge via <meta name="shopify-api-key">, and App Bridge
		// reads shop/host from the URL params that Shopify Admin passes in the iframe.
		// App Bridge then handles session token injection for all subsequent fetches.

		// Resolve with dynamic CSP for the authenticated shop
		const shop = event.locals.shopify?.session?.shop || getShopFromRequest(event);
		const response = await resolve(event);
		if (shop) {
			response.headers.set(
				'Content-Security-Policy',
				`frame-ancestors https://${shop} https://admin.shopify.com;`
			);
		}
		return response;
	}

	return resolve(event);
};

function isPublicRoute(pathname: string): boolean {
	const publicRoutes = ['/webhooks', '/'];

	return publicRoutes.some(
		(route) => pathname === route || (route !== '/' && pathname.startsWith(route + '/'))
	);
}
