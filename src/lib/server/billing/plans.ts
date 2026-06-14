/**
 * Two plans: Free and Pro.
 * - Free: up to FREE_ALERTS_PER_MONTH abandoned-cart alerts per calendar month,
 *   then alerts pause until the next month or an upgrade.
 * - Pro: a flat $29/month recurring subscription with unlimited alerts.
 *
 * There is no per-recovery success fee — Cart Radar bills only the flat Pro fee.
 */
export type Plan = 'free' | 'pro';

export const BILLING = {
	subscriptionName: 'Cart Radar Pro',
	/** Flat monthly price for the Pro plan, in USD. */
	proPriceUsd: 29,
	/** Shopify recurring interval the price is charged on. */
	interval: 'EVERY_30_DAYS',
	/** Alerts a Free shop may send per calendar month before alerts pause. */
	freeAlertsPerMonth: 5
} as const;
