/**
 * Core Admin Client Types
 *
 * Single source of truth for AdminClient interface and related types.
 * Both SvelteKit's createAdmin and worker's createStandaloneAdmin implement this interface.
 */

/**
 * GraphQL response type - matches standard GraphQL response format
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
 * Options for GraphQL requests
 */
export interface GraphQLOptions<TVariables = Record<string, unknown>> {
	variables?: TVariables;
}

/**
 * Admin client interface - abstraction over Shopify Admin API clients
 *
 * This interface defines the contract that both SvelteKit's createAdmin
 * and worker's createStandaloneAdmin must satisfy. Using a single interface
 * ensures consistent behavior across all contexts.
 *
 * @example
 * ```ts
 * // With variables
 * const response = await admin.graphql(query, { variables: { id: 'gid://...' } });
 *
 * // Without variables
 * const response = await admin.graphql(query);
 *
 * // With empty options (edge case)
 * const response = await admin.graphql(query, {});
 * ```
 */
export interface AdminClient {
	/**
	 * Execute a GraphQL query or mutation against the Shopify Admin API
	 *
	 * @param query - GraphQL query string (use `#graphql` tag for IDE support)
	 * @param options - Optional variables and configuration
	 * @returns Promise with the parsed JSON response
	 */
	graphql<TData = unknown, TVariables extends Record<string, unknown> = Record<string, unknown>>(
		query: string,
		options?: GraphQLOptions<TVariables>
	): Promise<GraphQLResponse<TData>>;
}
