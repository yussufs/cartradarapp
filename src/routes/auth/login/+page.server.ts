import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const error = url.searchParams.get('error');
	return { error };
};

/**
 * Sanitize and normalize a shop domain input
 */
function sanitizeShopDomain(input: string): string | null {
	let shop = input.trim().toLowerCase();

	// Remove protocol
	shop = shop.replace(/^https?:\/\//, '');
	// Remove trailing slashes
	shop = shop.replace(/\/+$/, '');
	// Remove /admin paths
	shop = shop.replace(/\/admin.*$/, '');

	// Check if it looks like a valid domain
	if (!shop || shop.includes(' ')) {
		return null;
	}

	// Add .myshopify.com if not present
	if (!shop.includes('.')) {
		shop = `${shop}.myshopify.com`;
	}

	return shop;
}

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const shopInput = formData.get('shop') as string;

		if (!shopInput) {
			return fail(400, { error: 'Please enter your shop domain' });
		}

		const shop = sanitizeShopDomain(shopInput);

		if (!shop) {
			return fail(400, { error: 'Please enter a valid Shopify store domain' });
		}

		redirect(302, `/auth?shop=${encodeURIComponent(shop)}`);
	}
};
