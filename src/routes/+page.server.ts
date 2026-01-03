import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	// If accessed from Shopify (has shop param), redirect to /app
	if (url.searchParams.get('shop')) {
		redirect(302, `/app?${url.searchParams.toString()}`);
	}

	return {};
};
