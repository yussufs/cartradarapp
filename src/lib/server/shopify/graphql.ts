import type { Session } from '@shopify/shopify-api';
import { createAdminApiClient } from './index';

/**
 * GraphQL response types
 */
export interface GraphQLResponse<T = unknown> {
	data?: T;
	errors?: Array<{
		message: string;
		locations?: Array<{ line: number; column: number }>;
		path?: Array<string | number>;
		extensions?: Record<string, unknown>;
	}>;
	extensions?: Record<string, unknown>;
}

/**
 * GraphQL error class for better error handling
 */
export class GraphQLError extends Error {
	public errors: Array<{ message: string }>;

	constructor(errors: Array<{ message: string }>) {
		super(errors.map((e) => e.message).join(', '));
		this.name = 'GraphQLError';
		this.errors = errors;
	}
}

/**
 * Options for GraphQL requests
 */
export interface GraphQLOptions<TVariables = Record<string, unknown>> {
	variables?: TVariables;
}

/**
 * Admin client with typed GraphQL method
 */
export interface AdminClient {
	/**
	 * Execute a GraphQL query or mutation against the Shopify Admin API
	 *
	 * @param query - GraphQL query string (use `#graphql` tag for IDE support)
	 * @param options - Optional variables and configuration
	 * @returns Promise with the parsed JSON response
	 *
	 * @example
	 * ```ts
	 * const response = await admin.graphql(
	 *   `#graphql
	 *     query GetShop {
	 *       shop {
	 *         name
	 *         email
	 *       }
	 *     }
	 *   `
	 * );
	 *
	 * const data = await response.json();
	 * console.log(data.data.shop.name);
	 * ```
	 */
	graphql<TData = unknown, TVariables extends Record<string, unknown> = Record<string, unknown>>(
		query: string,
		options?: GraphQLOptions<TVariables>
	): Promise<GraphQLResponse<TData>>;

	/**
	 * The underlying session for this admin client
	 */
	session: Session;
}

/**
 * Creates an admin client with a typed graphql() method
 * This provides a cleaner API similar to @shopify/shopify-app-react-router
 *
 * @param session - The Shopify session to use for authentication
 * @returns AdminClient with graphql() method
 */
export function createAdmin(session: Session): AdminClient {
	const client = createAdminApiClient(session);

	return {
		session,
		async graphql<TData = unknown, TVariables extends Record<string, unknown> = Record<string, unknown>>(
			query: string,
			options?: GraphQLOptions<TVariables>
		): Promise<GraphQLResponse<TData>> {
			const response = await client.request<TData>(query, {
				variables: options?.variables
			});

			// The Shopify client returns the response directly (already parsed)
			return {
				data: response.data as TData | undefined,
				errors: response.errors as GraphQLResponse<TData>['errors'],
				extensions: response.extensions as Record<string, unknown> | undefined
			};
		}
	};
}

/**
 * Helper to throw on GraphQL errors
 * Use this when you want to fail fast on any GraphQL errors
 *
 * @example
 * ```ts
 * const response = await admin.graphql(query);
 * const data = throwOnErrors(response);
 * // data is now guaranteed to have no errors
 * ```
 */
export function throwOnErrors<T>(response: GraphQLResponse<T>): T {
	if (response.errors && response.errors.length > 0) {
		throw new GraphQLError(response.errors);
	}

	if (!response.data) {
		throw new Error('No data returned from GraphQL query');
	}

	return response.data;
}

/**
 * Type helper for extracting data from GraphQL operations
 * This works with the codegen-generated types
 */
export type ExtractData<T> = T extends GraphQLResponse<infer D> ? D : never;
