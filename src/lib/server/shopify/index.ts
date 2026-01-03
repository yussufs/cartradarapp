import '@shopify/shopify-api/adapters/web-api';
import { shopifyApi, ApiVersion, Session, type Shopify } from '@shopify/shopify-api';
import { DrizzleSessionStorage } from './session-storage';
import { env } from '$env/dynamic/private';

// Get environment variable with fallback
function getEnvVar(name: string, fallback?: string): string {
	const value = env[name];
	if (!value && !fallback) throw new Error(`${name} environment variable is required`);
	return value || fallback || '';
}

// Get app URL - Shopify CLI sets HOST or SHOPIFY_APP_URL
function getAppUrl(): string {
	// Shopify CLI sets HOST (deprecated) or SHOPIFY_APP_URL
	const appUrl = env.SHOPIFY_APP_URL || env.HOST;
	if (!appUrl) throw new Error('SHOPIFY_APP_URL or HOST environment variable is required');
	return appUrl;
}

let sessionStorageInstance: DrizzleSessionStorage | null = null;

function createShopifyApi(): Shopify {
	const appUrl = getAppUrl();
	const hostName = new URL(appUrl).hostname;

	return shopifyApi({
		apiKey: getEnvVar('SHOPIFY_API_KEY'),
		apiSecretKey: getEnvVar('SHOPIFY_API_SECRET'),
		scopes: getEnvVar('SCOPES').split(','),
		hostName: hostName,
		hostScheme: 'https',
		apiVersion: ApiVersion.October25,
		isEmbeddedApp: true
	});
}

// Create fresh instance each time to avoid stale config in development
function getShopify(): Shopify {
	return createShopifyApi();
}

function getSessionStorage(): DrizzleSessionStorage {
	if (!sessionStorageInstance) {
		sessionStorageInstance = new DrizzleSessionStorage();
	}
	return sessionStorageInstance;
}

// Export getters to allow lazy initialization
export const shopify = {
	get api() {
		return getShopify();
	},
	get sessionStorage() {
		return getSessionStorage();
	}
};

// Helper to get offline session ID for a shop
export function getOfflineSessionId(shop: string): string {
	return getShopify().session.getOfflineId(shop);
}

// Helper to create GraphQL client for a session
export function createAdminApiClient(session: Session) {
	return new (getShopify().clients.Graphql)({ session });
}

// Helper to create REST client for a session
export function createRestClient(session: Session) {
	return new (getShopify().clients.Rest)({ session });
}

export { ApiVersion, Session };
