import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { devToolsEnabled } from '$lib/server/dev/guard';

export const load: PageServerLoad = async () => {
	if (!devToolsEnabled()) error(404, 'Not found');
	return {};
};
