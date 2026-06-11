import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { alertRules, alerts, channelSettings, checkouts, shops } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { hasVerifiedRecipient } from '$lib/server/recipients';

const WINDOW_DAYS = 30;

export const GET: RequestHandler = async ({ request }) => {
	let shop: string;
	try {
		const { session } = await authenticateRequest(request);
		shop = session.shop;
	} catch (err) {
		const status = err instanceof AuthError ? 401 : 500;
		return json(
			{ error: 'Unauthorized' },
			{ status, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } }
		);
	}

	await ensureShopRow(shop);
	const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

	const [counts] = await db
		.select({
			highValue: sql<number>`count(*) filter (where ${checkouts.status} in ('abandoned', 'alerted', 'recovered'))`,
			missed: sql<number>`count(*) filter (where ${checkouts.status} = 'abandoned')`,
			recovered: sql<number>`count(*) filter (where ${checkouts.status} = 'recovered')`,
			recoveredExact: sql<number>`count(*) filter (where ${checkouts.status} = 'recovered' and ${checkouts.recoveryMatch} = 'token')`,
			recoveredInferred: sql<number>`count(*) filter (where ${checkouts.status} = 'recovered' and ${checkouts.recoveryMatch} in ('email', 'phone'))`,
			recoveredAmount: sql<string>`coalesce(sum(${checkouts.recoveredAmount}) filter (where ${checkouts.status} = 'recovered'), 0)`
		})
		.from(checkouts)
		.where(and(eq(checkouts.shop, shop), gte(checkouts.lastActivityAt, since)));

	const [alertCounts] = await db
		.select({ sent: sql<number>`count(*)` })
		.from(alerts)
		.where(
			and(
				eq(alerts.shop, shop),
				eq(alerts.status, 'sent'),
				eq(alerts.isTest, false),
				gte(alerts.createdAt, since)
			)
		);

	const recent = await db
		.select({
			id: checkouts.id,
			customerName: checkouts.customerName,
			customerEmail: checkouts.customerEmail,
			totalPrice: checkouts.totalPrice,
			currency: checkouts.currency,
			itemCount: checkouts.itemCount,
			status: checkouts.status,
			lastActivityAt: checkouts.lastActivityAt,
			recoveredAmount: checkouts.recoveredAmount
		})
		.from(checkouts)
		.where(
			and(
				eq(checkouts.shop, shop),
				inArray(checkouts.status, ['abandoned', 'alerted', 'recovered'])
			)
		)
		.orderBy(desc(checkouts.lastActivityAt))
		.limit(20);

	// Setup state for the onboarding checklist
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	const [rule] = await db
		.select({ enabled: alertRules.enabled })
		.from(alertRules)
		.where(eq(alertRules.shop, shop))
		.limit(1);
	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, shop))
		.limit(1);

	const hasChannel =
		!!channels &&
		((channels.emailEnabled && (await hasVerifiedRecipient(shop, 'email'))) ||
			(channels.slackEnabled && !!channels.slackWebhookUrl) ||
			(channels.smsEnabled && (await hasVerifiedRecipient(shop, 'sms'))));

	return json({
		windowDays: WINDOW_DAYS,
		kpis: {
			highValue: Number(counts.highValue),
			missed: Number(counts.missed),
			recovered: Number(counts.recovered),
			recoveredExact: Number(counts.recoveredExact),
			recoveredInferred: Number(counts.recoveredInferred),
			recoveredAmount: counts.recoveredAmount,
			alertsSent: Number(alertCounts.sent)
		},
		recent,
		setup: {
			ruleConfigured: !!rule && rule.enabled,
			channelConfigured: hasChannel,
			billingActive: shopRow.billingActive
		}
	});
};
