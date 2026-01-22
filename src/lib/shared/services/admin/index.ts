/**
 * Core Admin Module
 *
 * Single source of truth for AdminClient interface and implementations.
 * Re-exports all admin-related types, errors, helpers, and the standalone client.
 */

// Types
export type { AdminClient, GraphQLResponse, GraphQLOptions } from './types';

// Errors
export { GraphQLError } from './errors';

// Helpers
export { throwOnErrors, hasErrors, getErrorMessages, type ExtractData } from './helpers';

// Standalone client (for use outside SvelteKit)
export { createStandaloneAdmin } from './standalone';
