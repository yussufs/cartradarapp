import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';

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

		const colors = ['Red', 'Orange', 'Yellow', 'Green'];
		const color = colors[Math.floor(Math.random() * colors.length)];

		try {
			// Step 1: Create the product
			const response = await admin.graphql(
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

			const product = response.data?.productCreate?.product;
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
					product,
					variant: null
				};
			}

			// Step 2: Update the variant price to $100
			const variantResponse = await admin.graphql(
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

			return {
				success: true,
				product,
				variant: variantResponse.data?.productVariantsBulkUpdate?.productVariants
			};
		} catch (err) {
			console.error('Error creating product:', err);
			return {
				success: false,
				error: 'Failed to create product'
			};
		}
	}
};
