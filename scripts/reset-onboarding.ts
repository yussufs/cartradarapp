/**
 * Reset a single shop's onboarding state so the onboarding flow can be re-run.
 *
 * Scoped to ONE shop. Runs in a transaction, prints what it will delete before
 * and after, and supports a dry run that rolls everything back.
 *
 * Clears (for the given shop only):
 *   - alert_rules      -> ruleConfigured = false   (onboarding step 1 reopens)
 *   - alert_recipients -> no verified email         (onboarding step 2 reopens)
 *   - channel_settings -> Slack disconnected        (onboarding step 2 reopens)
 *   - alerts + checkouts -> clean dashboard for a fresh recording
 *
 * Leaves the `shops` row intact (install, plan/billing, attribution window).
 *
 * Usage (tsx is a devDependency; `pnpm tsx` runs the local binary):
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/reset-onboarding.ts <shop> [--dry-run]
 *
 * Examples:
 *   DATABASE_URL="..." pnpm tsx scripts/reset-onboarding.ts eu-vat-tax-exemption-dev-store.myshopify.com --dry-run
 *   DATABASE_URL="..." pnpm tsx scripts/reset-onboarding.ts eu-vat-tax-exemption-dev-store.myshopify.com
 */

import postgres from 'postgres';

const args = process.argv.slice(2);
const shop = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

const url = process.env.DATABASE_URL;

if (!shop || !url) {
	console.error(
		'Usage: DATABASE_URL="postgres://..." pnpm tsx scripts/reset-onboarding.ts <shop> [--dry-run]'
	);
	process.exit(1);
}

if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
	console.error(`Refusing: "${shop}" doesn't look like a *.myshopify.com domain.`);
	process.exit(1);
}

// Order matters: alerts reference checkouts (ON DELETE CASCADE), but test alerts
// have a NULL checkout_id, so clear alerts explicitly first, then checkouts.
const TABLES = ['alerts', 'checkouts', 'alert_recipients', 'alert_rules', 'channel_settings'];

// Mask password for logging
const masked = url.replace(/:([^@]+)@/, ':***@');
console.log(`Connecting to: ${masked}`);
console.log(`Shop:  ${shop}`);
console.log(`Mode:  ${dryRun ? 'DRY RUN (rollback)' : 'APPLY (commit)'}\n`);

const sql = postgres(url, { connect_timeout: 10, max: 1 });

async function counts(tx: postgres.TransactionSql): Promise<Record<string, number>> {
	const out: Record<string, number> = {};
	for (const table of TABLES) {
		const [row] = await tx`SELECT count(*)::int AS count FROM ${tx(table)} WHERE shop = ${shop}`;
		out[table] = row.count;
	}
	return out;
}

class DryRunRollback extends Error {}

try {
	let before: Record<string, number> = {};
	let after: Record<string, number> = {};

	try {
		await sql.begin(async (tx) => {
			before = await counts(tx);
			console.log('Rows for this shop (before):');
			console.table(before);

			for (const table of TABLES) {
				await tx`DELETE FROM ${tx(table)} WHERE shop = ${shop}`;
			}

			after = await counts(tx);
			if (dryRun) throw new DryRunRollback();
		});
	} catch (err) {
		if (!(err instanceof DryRunRollback)) throw err;
	}

	console.log(`\nRemaining for this shop (${dryRun ? 'would be' : 'now'}):`);
	console.table(after);

	const deleted = Object.values(before).reduce((a, b) => a + b, 0);
	console.log(
		dryRun
			? `\nDry run complete — ${deleted} row(s) would be deleted. Nothing changed.`
			: `\nDone — deleted ${deleted} row(s). Onboarding will start fresh for ${shop}.`
	);
} catch (err) {
	console.error('\nFailed:', err);
	process.exit(1);
} finally {
	await sql.end();
}
