/**
 * Database schema for Shopify app session storage
 * Uses Drizzle ORM with PostgreSQL
 *
 * Run `pnpm run db:push` to apply schema changes
 * Run `pnpm run db:studio` to browse data
 */
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * Session table for Shopify OAuth session storage
 * Stores both online (user-specific) and offline (store-wide) sessions
 */
export const session = pgTable('session', {
	// Primary key - session ID format: "offline_{shop}" or "online_{shop}_{userId}"
	id: text('id').primaryKey(),

	// Shop domain, e.g., "example.myshopify.com"
	shop: text('shop').notNull(),

	// OAuth state parameter for CSRF protection
	state: text('state').notNull(),

	// Whether this is an online (user-specific) or offline (store-wide) session
	isOnline: boolean('is_online').default(false).notNull(),

	// Comma-separated list of granted scopes
	scope: text('scope'),

	// When the access token expires (for online sessions)
	expires: timestamp('expires', { mode: 'date' }),

	// The OAuth access token
	accessToken: text('access_token').notNull(),

	// Online session user info (from OnlineAccessInfo)
	userId: text('user_id'),
	firstName: text('first_name'),
	lastName: text('last_name'),
	email: text('email'),
	accountOwner: boolean('account_owner').default(false),
	locale: text('locale'),
	collaborator: boolean('collaborator').default(false),
	emailVerified: boolean('email_verified').default(false),

	// Refresh token support (for expiring offline access tokens)
	refreshToken: text('refresh_token'),
	refreshTokenExpires: timestamp('refresh_token_expires', { mode: 'date' })
});
