/**
 * List the checkouts currently tracked for a shop (read-only).
 *
 * Usage:
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/check-checkouts.ts <shop>
 *
 * Example:
 *   DATABASE_URL="..." pnpm tsx scripts/check-checkouts.ts eu-vat-tax-exemption-dev-store.myshopify.com
 */

import postgres from 'postgres';

const args = process.argv.slice(2);
const shop = args.find((a) => !a.startsWith('--'));
const url = process.env.DATABASE_URL;

if (!shop || !url) {
	console.error('Usage: DATABASE_URL="postgres://..." pnpm tsx scripts/check-checkouts.ts <shop>');
	process.exit(1);
}

if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
	console.error(`Refusing: "${shop}" doesn't look like a *.myshopify.com domain.`);
	process.exit(1);
}

const masked = url.replace(/:([^@]+)@/, ':***@');
console.log(`Connecting to: ${masked}`);
console.log(`Shop: ${shop}\n`);

const sql = postgres(url, { connect_timeout: 10, max: 1 });

try {
	const rows = await sql<
		{
			token: string;
			status: string;
			total: string;
			currency: string;
			items: number;
			customer: string | null;
			last_activity: Date;
			alerted_at: Date | null;
		}[]
	>`
		SELECT
			left(checkout_token, 8) AS token,
			status,
			total_price       AS total,
			currency,
			item_count        AS items,
			coalesce(customer_email, customer_name) AS customer,
			last_activity_at  AS last_activity,
			alerted_at
		FROM checkouts
		WHERE shop = ${shop}
		ORDER BY last_activity_at DESC
	`;

	if (rows.length === 0) {
		console.log('No checkouts tracked for this shop yet.');
	} else {
		console.log(`${rows.length} checkout(s):`);
		console.table(rows);
	}
} catch (err) {
	console.error('\nFailed:', err);
	process.exit(1);
} finally {
	await sql.end();
}
