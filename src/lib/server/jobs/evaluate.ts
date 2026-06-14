/**
 * Abandonment evaluator: finds active checkouts that have gone quiet past a
 * rule's inactivity window and meet its value/item threshold, claims them, and
 * dispatches alerts.
 *
 * Self-heal: claiming sets status to 'abandoned' *before* dispatching, so a
 * transient send failure (or a crash mid-dispatch) would otherwise leave a cart
 * abandoned-but-unalerted forever. A second pass retries those, bounded by a max
 * attempt count and a cooldown so a permanently-failing cart can't loop.
 */
import { and, eq, exists, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { alertRules, checkouts, shops } from '$lib/shared/db/schema';
import { dispatchCheckoutAlert } from '$lib/server/alerts/dispatch';

const BATCH = 100;
const MAX_ALERT_ATTEMPTS = 5;
const RETRY_COOLDOWN_MINUTES = 2;

export async function evaluateAbandonedCheckouts(): Promise<number> {
	let alerted = 0;

	// 1. Fresh: active checkouts past an enabled rule's window + threshold.
	const ruleMatches = db
		.select({ one: sql`1` })
		.from(alertRules)
		.where(
			and(
				eq(alertRules.shop, checkouts.shop),
				eq(alertRules.enabled, true),
				sql`${checkouts.lastActivityAt} < now() - make_interval(mins => ${alertRules.inactivityMinutes})`,
				sql`(${checkouts.totalPrice} >= ${alertRules.thresholdAmount}
					OR (${alertRules.minItemCount} IS NOT NULL AND ${checkouts.itemCount} >= ${alertRules.minItemCount}))`
			)
		);

	const candidates = await db
		.select({ id: checkouts.id })
		.from(checkouts)
		.innerJoin(shops, eq(shops.shop, checkouts.shop))
		.where(and(eq(checkouts.status, 'active'), isNull(shops.uninstalledAt), exists(ruleMatches)))
		.limit(BATCH);

	if (candidates.length > 0) {
		// Claim before sending so a crash can't double-alert.
		const claimed = await db
			.update(checkouts)
			.set({ status: 'abandoned', updatedAt: new Date() })
			.where(
				and(
					inArray(
						checkouts.id,
						candidates.map((c) => c.id)
					),
					eq(checkouts.status, 'active')
				)
			)
			.returning();

		for (const checkout of claimed) {
			try {
				const outcome = await dispatchCheckoutAlert(checkout);
				if (outcome.status === 'sent') {
					alerted++;
				} else if (outcome.status === 'all_failed') {
					// Record the failed attempt so the retry pass picks it up later.
					await markAttemptFailed(checkout.id, 0);
				}
				// 'skipped' (no_channels / limit_reached) is intentional — not retried.
			} catch (err) {
				console.error(`Failed to dispatch alert for checkout ${checkout.id}:`, err);
				await markAttemptFailed(checkout.id, 0);
			}
		}

		console.log(`Evaluator: ${claimed.length} checkout(s) abandoned, ${alerted} alerted`);
	}

	// 2. Self-heal: abandoned carts whose delivery failed, cooled down, under cap.
	const retryRows = await db
		.select()
		.from(checkouts)
		.where(
			and(
				eq(checkouts.status, 'abandoned'),
				isNull(checkouts.alertedAt),
				gte(checkouts.alertAttempts, 1),
				lt(checkouts.alertAttempts, MAX_ALERT_ATTEMPTS),
				sql`${checkouts.updatedAt} < now() - make_interval(mins => ${RETRY_COOLDOWN_MINUTES})`,
				exists(
					db
						.select({ one: sql`1` })
						.from(shops)
						.where(and(eq(shops.shop, checkouts.shop), isNull(shops.uninstalledAt)))
				)
			)
		)
		.limit(BATCH);

	let retried = 0;
	for (const row of retryRows) {
		// Claim this retry by bumping the counter, guarded on the value we read, so
		// only one instance retries a given cart per cycle (exactly-once).
		const [claimed] = await db
			.update(checkouts)
			.set({ alertAttempts: row.alertAttempts + 1, updatedAt: new Date() })
			.where(and(eq(checkouts.id, row.id), eq(checkouts.alertAttempts, row.alertAttempts)))
			.returning();
		if (!claimed) continue; // another instance grabbed it

		try {
			const outcome = await dispatchCheckoutAlert(claimed);
			if (outcome.status === 'sent') {
				alerted++;
				retried++;
			}
		} catch (err) {
			console.error(`Retry dispatch failed for checkout ${claimed.id}:`, err);
		}
	}

	if (retried > 0) {
		console.log(`Evaluator: self-healed ${retried} previously-failed alert(s)`);
	}

	return alerted;
}

/** Records a failed delivery attempt and stamps updatedAt to start the cooldown. */
async function markAttemptFailed(checkoutId: string, currentAttempts: number): Promise<void> {
	await db
		.update(checkouts)
		.set({ alertAttempts: currentAttempts + 1, updatedAt: new Date() })
		.where(eq(checkouts.id, checkoutId));
}
