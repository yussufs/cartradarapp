/**
 * Single outcome-based plan: Cart Radar takes a success fee on each cart it
 * recovers — there is no monthly fee and no per-message charge. Merchants only
 * pay when an alert leads to a recovered sale.
 */
export const BILLING = {
	subscriptionName: 'Cart Radar',
	/** Fee as a fraction of the recovered order's value */
	feeRate: 0.01,
	/** Minimum fee per recovered cart, regardless of order size */
	minFeeUsd: 1,
	/**
	 * Default 30-day usage cap the merchant approves (and can raise). Shopify
	 * blocks usage charges past this, so it's set generously.
	 */
	defaultCappedAmountUsd: 500
} as const;

/** The success fee for a recovered order: max(1% of value, $1). */
export function recoveryFeeUsd(orderTotal: number): number {
	if (!isFinite(orderTotal) || orderTotal <= 0) return BILLING.minFeeUsd;
	return Math.max(orderTotal * BILLING.feeRate, BILLING.minFeeUsd);
}
