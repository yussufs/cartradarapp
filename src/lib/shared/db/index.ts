/**
 * Shared Database Module
 *
 * Framework-agnostic database setup and schema.
 * NO $lib/* or $env/* imports allowed.
 */

// Re-export schema
export * from './schema';

// Re-export connection factory
export { createDatabase, createDatabaseWithClose, type Database } from './connection';
