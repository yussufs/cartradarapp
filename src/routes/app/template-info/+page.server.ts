import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import type { AdminClient } from '$lib/shared/services';

const PRODUCT_COLORS = ['Red', 'Orange', 'Yellow', 'Green'];

function pickRandomColor(): string {
	return PRODUCT_COLORS[Math.floor(Math.random() * PRODUCT_COLORS.length)];
}

interface CreateProductResult {
	success: boolean;
	product?: {
		id: string;
		title: string;
		handle: string;
		status: string;
	};
	variant?: unknown;
	error?: string;
}

async function createSampleProduct(client: AdminClient): Promise<CreateProductResult> {
	const color = pickRandomColor();

	try {
		const response = await client.graphql(
			`#graphql
			mutation populateProduct($product: ProductCreateInput!) {
				productCreate(product: $product) {
					product {
						id
						title
						handle
						status
						variants(first: 10) {
							edges {
								node {
									id
									price
									barcode
									createdAt
								}
							}
						}
					}
				}
			}`,
			{
				variables: {
					product: {
						title: `${color} Snowboard`
					}
				}
			}
		);

		if (response.errors) {
			console.error('GraphQL errors:', response.errors);
			return {
				success: false,
				error: response.errors[0]?.message || 'GraphQL error'
			};
		}

		interface ProductCreateResponse {
			productCreate?: {
				product?: {
					id: string;
					title: string;
					handle: string;
					status: string;
					variants: {
						edges: Array<{
							node: { id: string; price: string; barcode?: string; createdAt: string };
						}>;
					};
				};
			};
		}

		const data = response.data as ProductCreateResponse;
		const product = data?.productCreate?.product;

		if (!product) {
			return {
				success: false,
				error: 'Failed to create product'
			};
		}

		const variantId = product.variants.edges[0]?.node?.id;
		if (!variantId) {
			return {
				success: true,
				product: {
					id: product.id,
					title: product.title,
					handle: product.handle,
					status: product.status
				},
				variant: null
			};
		}

		const variantResponse = await client.graphql(
			`#graphql
			mutation updateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
				productVariantsBulkUpdate(productId: $productId, variants: $variants) {
					productVariants {
						id
						price
						barcode
						createdAt
					}
				}
			}`,
			{
				variables: {
					productId: product.id,
					variants: [{ id: variantId, price: '100.00' }]
				}
			}
		);

		if (variantResponse.errors) {
			console.error('Variant update errors:', variantResponse.errors);
		}

		interface VariantUpdateResponse {
			productVariantsBulkUpdate?: {
				productVariants?: unknown;
			};
		}

		const variantData = variantResponse.data as VariantUpdateResponse;

		return {
			success: true,
			product: {
				id: product.id,
				title: product.title,
				handle: product.handle,
				status: product.status
			},
			variant: variantData?.productVariantsBulkUpdate?.productVariants
		};
	} catch (err) {
		console.error('Error creating product:', err);
		return {
			success: false,
			error: 'Failed to create product'
		};
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.shopify) {
		error(401, 'Not authenticated');
	}

	return {
		shop: locals.shopify.session.shop
	};
};

export const actions: Actions = {
	createProduct: async ({ locals }) => {
		if (!locals.shopify) {
			error(401, 'Not authenticated');
		}

		const { admin } = locals.shopify;
		return createSampleProduct(admin);
	}
};
