/**
 * Database Module
 *
 * SvelteKit entry point that initializes the database with env vars.
 * Re-exports schema and connection factory for external use.
 */
import { env } from '$env/dynamic/private';
import { createDatabase } from '$lib/shared/db/connection';

// Initialize database with SvelteKit env
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export const db = createDatabase(env.DATABASE_URL);
