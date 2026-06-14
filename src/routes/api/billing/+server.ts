import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq, gte, sql } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { checkouts, shops } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { BILLING } from '$lib/server/billing/plans';
import {
	activateBilling,
	cancelSubscription,
	getPlanState,
	syncBillingState
} from '$lib/server/billing/subscriptions';

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

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export const GET: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	await ensureShopRow(shop);
	let [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);

	// DB says inactive, but the activation webhook may have been missed (e.g.
	// delivered to another environment) — reconcile against Shopify directly.
	if (!shopRow.billingActive) {
		try {
			if (await syncBillingState(shop)) {
				[shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
			}
		} catch (err) {
			console.error(`Billing state sync failed for ${shop}:`, err);
		}
	}

	const plan = await getPlanState(shop);

	// Recovery analytics (last 30 days) — Cart Radar's value, independent of billing.
	const since = new Date(Date.now() - PERIOD_MS);
	const [recovery] = await db
		.select({
			recoveries: sql<number>`count(*)`,
			recoveredRevenue: sql<string>`coalesce(sum(${checkouts.recoveredAmount}), 0)`
		})
		.from(checkouts)
		.where(
			and(
				eq(checkouts.shop, shop),
				eq(checkouts.status, 'recovered'),
				gte(checkouts.recoveredAt, since)
			)
		);

	return json({
		plan: plan.plan,
		billingActive: shopRow.billingActive,
		pricing: {
			proPriceUsd: BILLING.proPriceUsd,
			freeAlertsPerMonth: BILLING.freeAlertsPerMonth
		},
		alerts: {
			used: plan.alertsUsed,
			limit: plan.limit,
			limitReached: plan.limitReached
		},
		periodDays: 30,
		recovery: {
			recoveries: Number(recovery.recoveries),
			recoveredRevenue: recovery.recoveredRevenue
		},
		currency: shopRow.currency ?? 'USD'
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	let body: { action?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	await ensureShopRow(shop);

	try {
		if (body.action === 'activate') {
			const confirmationUrl = await activateBilling(shop);
			return json({ confirmationUrl });
		}
		if (body.action === 'cancel') {
			await cancelSubscription(shop);
			return json({ ok: true });
		}
		return json({ error: 'Unknown action' }, { status: 422 });
	} catch (err) {
		// Surface Shopify's actual GraphQL error body (otherwise logged as "[Object]")
		const e = err as { response?: { body?: unknown }; body?: unknown };
		const detail = e?.response?.body ?? e?.body;
		console.error(
			`Billing action failed for ${shop}:`,
			detail ? JSON.stringify(detail, null, 2) : err
		);
		return json({ error: 'Could not complete that. Please try again.' }, { status: 500 });
	}
};
