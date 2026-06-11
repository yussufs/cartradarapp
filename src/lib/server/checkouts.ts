/**
 * Checkout tracking: ingests checkouts/create|update and orders/create webhooks
 * into the `checkouts` table that the abandonment evaluator works from.
 */
import { and, desc, eq, gte, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	checkouts,
	shops,
	type CheckoutStatus,
	type LineItemSnapshot,
	type RecoveryMatch
} from '$lib/shared/db/schema';
import type { CheckoutWebhookPayload, OrderWebhookPayload } from '$lib/types/shopify-webhooks';

function parseDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return isNaN(date.getTime()) ? null : date;
}

function extractCustomerName(payload: CheckoutWebhookPayload): string | null {
	const customer = payload.customer;
	if (customer?.first_name || customer?.last_name) {
		return [customer.first_name, customer.last_name].filter(Boolean).join(' ');
	}
	for (const address of [payload.billing_address, payload.shipping_address]) {
		if (address?.name) return address.name;
		if (address?.first_name || address?.last_name) {
			return [address.first_name, address.last_name].filter(Boolean).join(' ');
		}
	}
	return null;
}

function extractLineItems(payload: CheckoutWebhookPayload): LineItemSnapshot[] {
	return (payload.line_items ?? []).map((item) => ({
		title: item.title ?? 'Unknown item',
		quantity: item.quantity ?? 1,
		price: item.price ?? item.line_price ?? '0.00',
		variantTitle: item.variant_title ?? null,
		sku: item.sku ?? null
	}));
}

/** Make sure a `shops` row exists (normally created at install; this is a safety net). */
export async function ensureShopRow(shop: string): Promise<void> {
	await db.insert(shops).values({ shop }).onConflictDoNothing();
}

export async function upsertCheckoutFromWebhook(
	shop: string,
	payload: CheckoutWebhookPayload
): Promise<void> {
	if (!payload.token) return;

	await ensureShopRow(shop);

	const lineItems = extractLineItems(payload);
	const isCompleted = !!payload.completed_at;
	const values = {
		shopifyCheckoutId: String(payload.id),
		abandonedCheckoutUrl: payload.abandoned_checkout_url ?? null,
		totalPrice: payload.total_price ?? '0.00',
		currency: payload.presentment_currency ?? payload.currency ?? 'USD',
		itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
		customerName: extractCustomerName(payload),
		customerEmail: payload.email ?? payload.customer?.email ?? null,
		customerPhone:
			payload.phone ??
			payload.customer?.phone ??
			payload.billing_address?.phone ??
			payload.shipping_address?.phone ??
			null,
		lineItems,
		checkoutCreatedAt: parseDate(payload.created_at),
		lastActivityAt: parseDate(payload.updated_at) ?? new Date(),
		updatedAt: new Date()
	};

	const [existing] = await db
		.select({ id: checkouts.id, status: checkouts.status })
		.from(checkouts)
		.where(and(eq(checkouts.shop, shop), eq(checkouts.checkoutToken, payload.token)))
		.limit(1);

	if (!existing) {
		await db
			.insert(checkouts)
			.values({
				shop,
				checkoutToken: payload.token,
				status: isCompleted ? 'completed' : 'active',
				...values
			})
			.onConflictDoNothing();
		return;
	}

	await db
		.update(checkouts)
		.set({ ...values, status: nextStatus(existing.status, isCompleted) })
		.where(eq(checkouts.id, existing.id));
}

function nextStatus(current: CheckoutStatus, isCompleted: boolean): CheckoutStatus {
	// Terminal states never regress
	if (current === 'recovered' || current === 'completed') return current;
	if (isCompleted) return current === 'alerted' ? 'recovered' : 'completed';
	// Once alerted, stays alerted until an order arrives
	if (current === 'alerted') return 'alerted';
	// New activity on an abandoned-but-unalerted checkout puts it back in play
	return 'active';
}

async function markRecovered(
	checkoutId: string,
	orderId: string,
	amount: string | null,
	match: RecoveryMatch
): Promise<void> {
	await db
		.update(checkouts)
		.set({
			status: 'recovered',
			recoveredAt: new Date(),
			recoveredOrderId: orderId,
			recoveredAmount: amount,
			recoveryMatch: match,
			updatedAt: new Date()
		})
		.where(eq(checkouts.id, checkoutId));
}

/**
 * Resolves an order to the checkout it recovered, if any:
 *  1. Exact: the order's checkout_token matches a checkout we alerted on.
 *  2. Inferred: no token match, but the same customer (email/phone) has an
 *     alerted cart within the shop's attribution window, completed via a fresh
 *     checkout. Tracked separately via `recoveryMatch` so the stat stays honest.
 */
export async function markCheckoutOrdered(
	shop: string,
	payload: OrderWebhookPayload
): Promise<void> {
	const orderId = String(payload.id);
	const orderRef = payload.name ?? orderId;
	const orderCreatedAt = parseDate(payload.created_at) ?? new Date();
	const token = payload.checkout_token;

	// 1. Exact token match
	let tokenCheckout: { id: string; status: CheckoutStatus } | undefined;
	if (token) {
		[tokenCheckout] = await db
			.select({ id: checkouts.id, status: checkouts.status })
			.from(checkouts)
			.where(and(eq(checkouts.shop, shop), eq(checkouts.checkoutToken, token)))
			.limit(1);
	}

	if (tokenCheckout) {
		if (tokenCheckout.status === 'recovered' || tokenCheckout.status === 'completed') return;
		if (tokenCheckout.status === 'alerted') {
			await markRecovered(tokenCheckout.id, orderId, payload.total_price ?? null, 'token');
			console.log(`Recovered (token) checkout for ${shop} via order ${orderRef}`);
			return;
		}
		// Same checkout completed without an alert — record completion, then still
		// check whether this order recovers a *different* alerted cart (below).
		await db
			.update(checkouts)
			.set({ status: 'completed', recoveredOrderId: orderId, updatedAt: new Date() })
			.where(eq(checkouts.id, tokenCheckout.id));
	}

	// 2. Inferred email/phone match against a different alerted cart
	const email = (payload.email ?? payload.contact_email ?? payload.customer?.email ?? '')
		.trim()
		.toLowerCase();
	const phoneDigits = (payload.phone ?? payload.customer?.phone ?? '').replace(/\D/g, '');
	if (!email && !phoneDigits) return;

	const [shopRow] = await db
		.select({ windowDays: shops.attributionWindowDays })
		.from(shops)
		.where(eq(shops.shop, shop))
		.limit(1);
	const windowDays = shopRow?.windowDays ?? 14;
	const cutoff = new Date(orderCreatedAt.getTime() - windowDays * 24 * 60 * 60 * 1000);

	const identityMatch: SQL[] = [];
	if (email) identityMatch.push(sql`lower(${checkouts.customerEmail}) = ${email}`);
	if (phoneDigits) {
		identityMatch.push(
			sql`regexp_replace(coalesce(${checkouts.customerPhone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`
		);
	}

	const [match] = await db
		.select()
		.from(checkouts)
		.where(
			and(
				eq(checkouts.shop, shop),
				eq(checkouts.status, 'alerted'),
				gte(checkouts.alertedAt, cutoff),
				lte(checkouts.alertedAt, orderCreatedAt),
				or(...identityMatch),
				tokenCheckout ? ne(checkouts.id, tokenCheckout.id) : undefined
			)
		)
		.orderBy(desc(checkouts.alertedAt))
		.limit(1);

	if (!match) return;

	const matchedByEmail = !!email && (match.customerEmail ?? '').toLowerCase() === email;
	const recoveryMatch: RecoveryMatch = matchedByEmail ? 'email' : 'phone';
	await markRecovered(match.id, orderId, payload.total_price ?? null, recoveryMatch);
	console.log(`Recovered (inferred:${recoveryMatch}) checkout for ${shop} via order ${orderRef}`);
}
