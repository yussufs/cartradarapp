import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { PLANS } from '$lib/server/billing/plans';
import { cancelSubscription, createSubscription } from '$lib/server/billing/subscriptions';

async function authenticate(request: Request) {
	try {
		const { session } = await authenticateRequest(request);
		return { shop: session.shop, response: null };
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		return {
			shop: null,
			response: json(
				{ error: 'Unauthorized' },
				{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
			)
		};
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	await ensureShopRow(shop);
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);

	return json({
		current: {
			plan: shopRow.plan,
			alertsUsed: shopRow.alertsUsedThisPeriod,
			smsUsed: shopRow.smsUsedThisPeriod,
			periodStartedAt: shopRow.periodStartedAt
		},
		plans: Object.values(PLANS).map((plan) => ({
			plan: plan.plan,
			monthlyPriceUsd: plan.monthlyPriceUsd,
			alertLimit: plan.alertLimit,
			includedSms: plan.includedSms,
			smsPricing: plan.smsPricing,
			defaultCappedAmountUsd: plan.defaultCappedAmountUsd
		}))
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	let body: { plan?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const plan = body.plan;
	if (plan !== 'free' && plan !== 'pro' && plan !== 'scale') {
		return json({ error: 'Unknown plan' }, { status: 422 });
	}

	await ensureShopRow(shop);

	try {
		if (plan === 'free') {
			// Downgrade: cancel the active subscription; the billing webhook flips the plan
			await cancelSubscription(shop);
			return json({ ok: true });
		}
		const confirmationUrl = await createSubscription(shop, plan);
		return json({ confirmationUrl });
	} catch (err) {
		console.error(`Billing change failed for ${shop}:`, err);
		return json({ error: 'Could not start the plan change. Please try again.' }, { status: 500 });
	}
};
