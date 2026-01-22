/**
 * Standalone Admin Client
 *
 * This module provides a typed GraphQL client for use outside of SvelteKit context
 * (e.g., in a worker process). It uses @shopify/admin-api-client directly.
 *
 * For SvelteKit routes/components, use the regular createAdmin() from graphql.ts instead.
 */
import { createAdminApiClient } from '@shopify/admin-api-client';
import type { AdminClient, GraphQLOptions, GraphQLResponse } from './types';

/**
 * Creates a standalone admin client for use outside SvelteKit context
 *
 * @param shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param accessToken - The shop's access token
 * @param apiVersion - The Shopify API version (default: "2025-01")
 */
export function createStandaloneAdmin(
	shopDomain: string,
	accessToken: string,
	apiVersion = '2025-01'
): AdminClient {
	const client = createAdminApiClient({
		storeDomain: shopDomain,
		apiVersion,
		accessToken
	});

	return {
		async graphql<TData, TVariables extends Record<string, unknown>>(
			query: string,
			options?: GraphQLOptions<TVariables>
		): Promise<GraphQLResponse<TData>> {
			try {
				const response = await client.request<TData>(query, {
					variables: options?.variables
				});

				// The admin-api-client can return errors in different ways
				// Handle the case where response contains an errors property
				if ('errors' in response && response.errors) {
					const errorResponse = response as {
						errors: {
							graphQLErrors?: Array<{ message: string }>;
							message?: string;
						};
					};

					const graphQLErrors = errorResponse.errors.graphQLErrors || [];
					if (graphQLErrors.length > 0) {
						return {
							errors: graphQLErrors.map((e) => ({ message: e.message }))
						};
					}

					// General error message
					if (errorResponse.errors.message) {
						return {
							errors: [{ message: errorResponse.errors.message }]
						};
					}
				}

				// Success case - data is directly on response
				return {
					data: response.data as TData
				};
			} catch (err) {
				// Handle thrown errors
				const message = err instanceof Error ? err.message : 'Unknown error';
				return {
					errors: [{ message }]
				};
			}
		}
	};
}
