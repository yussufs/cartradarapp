import type { ShopPlan } from '$lib/shared/db/schema';
import type { SmsZonePricing } from './sms-zones';

export interface PlanDefinition {
	plan: ShopPlan;
	/** Subscription name shown to the merchant and reported in billing webhooks */
	subscriptionName: string | null;
	monthlyPriceUsd: number;
	/** Max alert events per 30-day period; null = unlimited */
	alertLimit: number | null;
	/**
	 * Included SMS per period — applies to DOMESTIC (US/Canada) numbers only.
	 * International SMS is metered from the first message (see smsPricing).
	 */
	includedSms: number;
	/** Per-message overage price by zone; null = SMS not available on this plan */
	smsPricing: SmsZonePricing | null;
	/** Default usage cap (merchant-adjustable via appSubscriptionLineItemUpdate) */
	defaultCappedAmountUsd: number;
	/** Number of alert rules allowed */
	maxRules: number;
}

export const PLANS: Record<ShopPlan, PlanDefinition> = {
	free: {
		plan: 'free',
		subscriptionName: null,
		monthlyPriceUsd: 0,
		alertLimit: 10,
		includedSms: 0,
		smsPricing: null,
		defaultCappedAmountUsd: 0,
		maxRules: 1
	},
	pro: {
		plan: 'pro',
		subscriptionName: 'Cart Radar Pro',
		monthlyPriceUsd: 15,
		alertLimit: null,
		includedSms: 50,
		// Domestic ~4x carrier cost; international ~3x typical AU/UK/EU cost
		smsPricing: { domestic: 0.05, international: 0.15 },
		defaultCappedAmountUsd: 25,
		maxRules: 1
	},
	scale: {
		plan: 'scale',
		subscriptionName: 'Cart Radar Scale',
		monthlyPriceUsd: 39,
		alertLimit: null,
		includedSms: 300,
		smsPricing: { domestic: 0.04, international: 0.12 },
		defaultCappedAmountUsd: 60,
		maxRules: 5
	}
};

export const PLAN_BY_SUBSCRIPTION_NAME: Record<string, ShopPlan> = Object.fromEntries(
	Object.values(PLANS)
		.filter((p) => p.subscriptionName)
		.map((p) => [p.subscriptionName as string, p.plan])
);

/** Length of a usage period. Matches Shopify's EVERY_30_DAYS billing interval. */
export const PERIOD_DAYS = 30;
