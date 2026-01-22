/**
 * GraphQL Error Classes
 *
 * Custom error types for better GraphQL error handling.
 */

/**
 * GraphQL error class for better error handling
 *
 * Use this when you need to throw on GraphQL errors while preserving
 * the original error information.
 */
export class GraphQLError extends Error {
	public errors: Array<{ message: string }>;

	constructor(errors: Array<{ message: string }>) {
		super(errors.map((e) => e.message).join(', '));
		this.name = 'GraphQLError';
		this.errors = errors;
	}
}
