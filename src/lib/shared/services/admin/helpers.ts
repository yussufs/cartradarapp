/**
 * GraphQL Response Helpers
 *
 * Utility functions for working with GraphQL responses.
 */

import type { GraphQLResponse } from './types';
import { GraphQLError } from './errors';

/**
 * Helper to throw on GraphQL errors
 *
 * Use this when you want to fail fast on any GraphQL errors.
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
 * Helper to check if a GraphQL response has errors
 */
export function hasErrors<T>(response: GraphQLResponse<T>): boolean {
	return Boolean(response.errors && response.errors.length > 0);
}

/**
 * Helper to get error messages from a GraphQL response
 */
export function getErrorMessages<T>(response: GraphQLResponse<T>): string[] {
	if (!response.errors) return [];
	return response.errors.map((e) => e.message);
}

/**
 * Type helper for extracting data from GraphQL operations
 *
 * This works with the codegen-generated types.
 */
export type ExtractData<T> = T extends GraphQLResponse<infer D> ? D : never;
