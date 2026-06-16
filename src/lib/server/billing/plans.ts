/**
 * Two plans: Free and Pro.
 * - Free: up to FREE_ALERTS_PER_MONTH abandoned-cart alerts per calendar month,
 *   then alerts pause until the next month or an upgrade.
 * - Pro: unlimited alerts, billed either monthly ($29/mo) or yearly ($228/yr,
 *   which works out to $19/mo).
 *
 * There is no per-recovery success fee — Cart Radar bills only the flat Pro fee.
 */
export type Plan = 'free' | 'pro';
export type BillingInterval = 'monthly' | 'annual';

export const BILLING = {
	subscriptionName: 'Cart Radar Pro',
	/** Pro price when billed monthly (USD per month). */
	proPriceUsd: 29,
	/** Pro price when billed yearly (USD per year) — 12 × proYearlyPerMonthUsd. */
	proYearlyUsd: 228,
	/** Per-month equivalent of the yearly plan, for display ($19/mo). */
	proYearlyPerMonthUsd: 19,
	/** Alerts a Free shop may send per calendar month before alerts pause. */
	freeAlertsPerMonth: 5
} as const;

/** Maps our interval to Shopify's AppPricingInterval and the amount charged. */
export function intervalPricing(interval: BillingInterval): {
	shopifyInterval: 'EVERY_30_DAYS' | 'ANNUAL';
	amount: number;
} {
	return interval === 'annual'
		? { shopifyInterval: 'ANNUAL', amount: BILLING.proYearlyUsd }
		: { shopifyInterval: 'EVERY_30_DAYS', amount: BILLING.proPriceUsd };
}
