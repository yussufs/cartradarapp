/**
 * Database Connection Factory
 *
 * Creates a Drizzle ORM database instance with the provided connection URL.
 * This module is framework-agnostic - NO $lib/* or $env/* imports.
 *
 * Usage:
 *   import { createDatabase } from './connection';
 *   const db = createDatabase(process.env.DATABASE_URL);
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database instance type
 */
export type Database = ReturnType<typeof createDatabase>;

/**
 * Create a database connection with the given URL
 *
 * @param url - PostgreSQL connection URL
 * @returns Drizzle database instance with schema
 */
export function createDatabase(url: string) {
	if (!url) {
		throw new Error('DATABASE_URL is required');
	}

	const client = postgres(url);
	return drizzle(client, { schema });
}

/**
 * Create a database connection and return both the db instance and underlying client
 * Useful when you need to close the connection later (e.g., in workers)
 *
 * @param url - PostgreSQL connection URL
 * @returns Object with db instance and close function
 */
export function createDatabaseWithClose(url: string) {
	if (!url) {
		throw new Error('DATABASE_URL is required');
	}

	const client = postgres(url);
	const db = drizzle(client, { schema });

	return {
		db,
		close: async () => {
			await client.end();
		}
	};
}
