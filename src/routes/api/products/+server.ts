import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { shopify, getOfflineSessionId } from '$lib/server/shopify';
import { createAdmin } from '$lib/server/shopify/graphql';

export const GET: RequestHandler = async ({ request, url }) => {
	// Authenticate using session token from Authorization header
	const authHeader = request.headers.get('authorization');

	if (!authHeader?.startsWith('Bearer ')) {
		error(401, 'Unauthorized');
	}

	const token = authHeader.substring(7);

	// Get search query from URL params
	const searchQuery = url.searchParams.get('search') || '';

	let session;
	try {
		const payload = await shopify.api.session.decodeSessionToken(token);
		const shop = payload.dest.replace('https://', '');
		const sessionId = getOfflineSessionId(shop);
		session = await shopify.sessionStorage.loadSession(sessionId);

		if (!session || !session.accessToken) {
			error(401, 'Session not found');
		}
	} catch {
		error(401, 'Invalid session token');
	}

	const admin = createAdmin(session);

	try {
		const response = await admin.graphql(
			`#graphql
			query GetProducts($first: Int!, $query: String) {
				products(first: $first, query: $query) {
					edges {
						node {
							id
							title
							status
							createdAt
							featuredMedia {
								preview {
									image {
										url
										altText
									}
								}
							}
							variants(first: 1) {
								edges {
									node {
										price
										inventoryQuantity
									}
								}
							}
						}
					}
				}
			}`,
			{
				variables: {
					first: 25,
					query: searchQuery || null
				}
			}
		);

		if (response.errors) {
			console.error('GraphQL errors:', response.errors);
			return json({
				products: [],
				error: response.errors[0]?.message || 'Failed to fetch products'
			});
		}

		interface ProductNode {
			id: string;
			title: string;
			status: string;
			createdAt: string;
			featuredMedia?: {
				preview?: {
					image?: { url: string; altText?: string };
				};
			};
			variants: {
				edges: Array<{ node: { price: string; inventoryQuantity?: number } }>;
			};
		}

		const responseData = response.data as { products?: { edges?: Array<{ node: ProductNode }> } };
		const products =
			responseData.products?.edges?.map((edge) => ({
				id: edge.node.id,
				title: edge.node.title,
				status: edge.node.status,
				createdAt: edge.node.createdAt,
				image: edge.node.featuredMedia?.preview?.image?.url || null,
				imageAlt: edge.node.featuredMedia?.preview?.image?.altText || edge.node.title,
				price: edge.node.variants.edges[0]?.node?.price || '0.00',
				inventory: edge.node.variants.edges[0]?.node?.inventoryQuantity ?? null
			})) || [];

		return json({ products });
	} catch (err) {
		console.error('Error fetching products:', err);
		return json({
			products: [],
			error: 'Failed to fetch products'
		});
	}
};
