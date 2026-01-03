import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const error = url.searchParams.get('error');
	return { error };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const shopInput = formData.get('shop') as string;

		if (!shopInput) {
			return fail(400, { error: 'Please enter your shop domain' });
		}

		// Sanitize and validate shop domain
		let shop = shopInput.trim().toLowerCase();

		// Remove protocol if present
		shop = shop.replace(/^https?:\/\//, '');

		// Remove trailing slash
		shop = shop.replace(/\/$/, '');

		// Add .myshopify.com if not present
		if (!shop.includes('.myshopify.com')) {
			shop = `${shop}.myshopify.com`;
		}

		// Validate shop domain format
		const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
		if (!shopRegex.test(shop)) {
			return fail(400, { error: 'Please enter a valid Shopify store domain' });
		}

		// Redirect to OAuth start
		redirect(302, `/auth?shop=${encodeURIComponent(shop)}`);
	}
};
