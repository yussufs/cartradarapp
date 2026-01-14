import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.shopify) {
		error(401, 'Not authenticated');
	}

	return {
		shop: locals.shopify.session.shop
	};
};
