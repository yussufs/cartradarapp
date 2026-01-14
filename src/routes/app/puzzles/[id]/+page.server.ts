import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

interface Puzzle {
	id: string;
	name: string;
	description: string;
	pieces: number;
	size: string;
	material: string;
	price: string;
	stock: number;
	created: string;
	status: 'active' | 'draft';
	image: string;
	featured: boolean;
}

// Mock data - replace with actual API call
const mockPuzzles: Record<string, Puzzle> = {
	'1': {
		id: '1',
		name: 'Mountain View',
		description: 'A beautiful mountain landscape puzzle featuring snow-capped peaks and lush green valleys.',
		pieces: 16,
		size: 'medium',
		material: 'cardboard',
		price: '24.99',
		stock: 150,
		created: 'Today',
		status: 'active',
		image: 'https://picsum.photos/id/29/400/400',
		featured: true
	},
	'2': {
		id: '2',
		name: 'Ocean Sunset',
		description: 'Capture the serene beauty of a sunset over the ocean with vibrant oranges and deep blues.',
		pieces: 9,
		size: 'small',
		material: 'wood',
		price: '19.99',
		stock: 75,
		created: 'Yesterday',
		status: 'active',
		image: 'https://picsum.photos/id/12/400/400',
		featured: false
	},
	'3': {
		id: '3',
		name: 'Forest Animals',
		description: 'An educational puzzle featuring various forest animals in their natural habitat.',
		pieces: 25,
		size: 'large',
		material: 'cardboard',
		price: '29.99',
		stock: 0,
		created: 'Last week',
		status: 'draft',
		image: 'https://picsum.photos/id/324/400/400',
		featured: false
	},
	'4': {
		id: '4',
		name: 'City Skyline',
		description: 'A stunning nighttime cityscape featuring illuminated skyscrapers and city lights.',
		pieces: 36,
		size: 'large',
		material: 'premium',
		price: '34.99',
		stock: 200,
		created: 'Last week',
		status: 'active',
		image: 'https://picsum.photos/id/1067/400/400',
		featured: true
	},
	'5': {
		id: '5',
		name: 'Desert Dunes',
		description: 'Experience the tranquil beauty of golden sand dunes under a clear blue sky.',
		pieces: 16,
		size: 'medium',
		material: 'wood',
		price: '27.99',
		stock: 50,
		created: '2 weeks ago',
		status: 'draft',
		image: 'https://picsum.photos/id/1035/400/400',
		featured: false
	}
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.shopify) {
		error(401, 'Not authenticated');
	}

	const puzzle = mockPuzzles[params.id];

	if (!puzzle) {
		error(404, 'Puzzle not found');
	}

	return {
		shop: locals.shopify.session.shop,
		puzzle
	};
};
