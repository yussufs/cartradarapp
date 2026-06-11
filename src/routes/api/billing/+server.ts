import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { shops, usageCharges } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { BILLING } from '$lib/server/billing/plans';
import {
	activateBilling,
	cancelSubscription,
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

	const since = new Date(Date.now() - PERIOD_MS);
	const [usage] = await db
		.select({
			feeCount: sql<number>`count(*)`,
			feeTotal: sql<string>`coalesce(sum(${usageCharges.amount}), 0)`,
			recoveredTotal: sql<string>`coalesce(sum(${usageCharges.recoveredAmount}), 0)`
		})
		.from(usageCharges)
		.where(and(eq(usageCharges.shop, shop), gte(usageCharges.createdAt, since)));

	const recent = await db
		.select({
			id: usageCharges.id,
			orderId: usageCharges.orderId,
			recoveredAmount: usageCharges.recoveredAmount,
			amount: usageCharges.amount,
			billed: sql<boolean>`${usageCharges.shopifyUsageRecordId} is not null`,
			createdAt: usageCharges.createdAt
		})
		.from(usageCharges)
		.where(eq(usageCharges.shop, shop))
		.orderBy(desc(usageCharges.createdAt))
		.limit(10);

	return json({
		billingActive: shopRow.billingActive,
		pricing: {
			feePercent: BILLING.feeRate * 100,
			minFeeUsd: BILLING.minFeeUsd,
			cappedAmountUsd: BILLING.defaultCappedAmountUsd
		},
		periodDays: 30,
		usage: {
			recoveries: Number(usage.feeCount),
			feesUsd: usage.feeTotal,
			recoveredRevenue: usage.recoveredTotal
		},
		recent,
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
