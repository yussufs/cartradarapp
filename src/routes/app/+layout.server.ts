import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return {
		apiKey: env.SHOPIFY_API_KEY,
		shop: locals.shopify?.session?.shop || url.searchParams.get('shop') || '',
		devTools: env.DEV_TOOLS === 'true'
	};
};
