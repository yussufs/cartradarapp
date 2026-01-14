import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.shopify) {
		error(401, 'Not authenticated');
	}

	// Return minimal data - products will be fetched client-side
	return {
		shop: locals.shopify.session.shop
	};
};
