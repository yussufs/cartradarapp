/**
 * Shared Services Module
 *
 * This module provides shared code that works in both:
 * - SvelteKit services (using $lib imports)
 * - Standalone workers (using direct imports)
 *
 * IMPORTANT: This module must NOT import any $lib/* or $env/* paths.
 */

// Admin client types, helpers, and standalone implementation
export * from './admin';

// Types
export type { Database } from './types';
