/**
 * Abandonment evaluator: finds active checkouts that have gone quiet past a
 * rule's inactivity window and meet its value/item threshold, claims them,
 * and dispatches alerts.
 */
import { and, eq, exists, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { alertRules, checkouts, shops } from '$lib/shared/db/schema';
import { dispatchCheckoutAlert } from '$lib/server/alerts/dispatch';

export async function evaluateAbandonedCheckouts(): Promise<number> {
	// A checkout qualifies when at least one enabled rule for its shop matches:
	// inactive past the rule's window AND (total >= threshold OR item count >= minItemCount).
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
		.limit(100);

	if (candidates.length === 0) return 0;

	// Claim before sending so a crash can't double-alert
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

	let alerted = 0;
	for (const checkout of claimed) {
		try {
			const outcome = await dispatchCheckoutAlert(checkout);
			if (outcome.status === 'sent') alerted++;
		} catch (err) {
			console.error(`Failed to dispatch alert for checkout ${checkout.id}:`, err);
		}
	}

	if (claimed.length > 0) {
		console.log(`Evaluator: ${claimed.length} checkout(s) abandoned, ${alerted} alerted`);
	}
	return alerted;
}
