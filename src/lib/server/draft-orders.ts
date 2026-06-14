/**
 * Merchant-initiated recovery: create a draft order from an abandoned cart and
 * attribute the resulting order back to Cart Radar when it completes.
 *
 * Attribution flow: draftOrderCreate stores the draft order ID on the checkout
 * row → the draft_orders/update webhook fires with status "completed" and the
 * resulting order_id → markDraftOrderCompleted flips the cart to recovered
 * ('draft_order' match). orders/create for the same order is ignored by the
 * inference matcher (see markCheckoutOrdered), and all paths are idempotent:
 * recovery is status-guarded.
 */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { checkouts } from '$lib/shared/db/schema';
import { throwOnErrors, type AdminClient } from '$lib/server/shopify/graphql';
import type { DraftOrderWebhookPayload } from '$lib/types/shopify-webhooks';

export class DraftOrderError extends Error {
	constructor(
		public code: 'not_found' | 'wrong_status' | 'already_exists' | 'no_line_items' | 'shopify',
		message: string
	) {
		super(message);
		this.name = 'DraftOrderError';
	}
}

export interface CreatedDraftOrder {
	id: string;
	name: string;
	invoiceUrl: string | null;
}

/** Admin page for a draft order, e.g. https://admin.shopify.com/store/foo/draft_orders/123 */
export function draftOrderAdminUrl(shop: string, draftOrderGid: string): string {
	const handle = shop.replace('.myshopify.com', '');
	const numericId = draftOrderGid.split('/').pop();
	return `https://admin.shopify.com/store/${handle}/draft_orders/${numericId}`;
}

interface UserError {
	field?: string[] | null;
	message: string;
}

/**
 * Creates a Shopify draft order mirroring the cart's contents as catalog
 * line items (live pricing, inventory).
 */
export async function createDraftOrderFromCheckout(
	admin: AdminClient,
	shop: string,
	checkoutId: string
): Promise<CreatedDraftOrder> {
	const [checkout] = await db
		.select()
		.from(checkouts)
		.where(and(eq(checkouts.id, checkoutId), eq(checkouts.shop, shop)))
		.limit(1);

	if (!checkout) throw new DraftOrderError('not_found', 'Checkout not found');
	if (checkout.draftOrderId) {
		throw new DraftOrderError(
			'already_exists',
			`A draft order (${checkout.draftOrderName}) already exists for this cart`
		);
	}
	if (checkout.status !== 'abandoned' && checkout.status !== 'alerted') {
		throw new DraftOrderError(
			'wrong_status',
			'Draft orders can only be created for abandoned carts'
		);
	}
	if (checkout.lineItems.length === 0) {
		throw new DraftOrderError('no_line_items', 'This cart has no line items');
	}
	if (checkout.lineItems.some((item) => !item.variantId)) {
		throw new DraftOrderError('no_line_items', 'This cart is missing product variant data');
	}

	const lineItems = checkout.lineItems.map((item) => ({
		variantId: `gid://shopify/ProductVariant/${item.variantId}`,
		quantity: item.quantity
	}));

	const response = await admin.graphql<{
		draftOrderCreate: {
			userErrors: UserError[];
			draftOrder: { id: string; name: string; invoiceUrl: string | null } | null;
		};
	}>(
		`#graphql
		mutation CartRadarDraftOrderCreate($input: DraftOrderInput!) {
			draftOrderCreate(input: $input) {
				userErrors { field message }
				draftOrder { id name invoiceUrl }
			}
		}`,
		{
			variables: {
				input: {
					lineItems,
					email: checkout.customerEmail ?? undefined,
					note: 'Created by Cart Radar from an abandoned cart',
					tags: ['cart-radar-recovery']
				}
			}
		}
	);

	const data = throwOnErrors(response);
	const { userErrors, draftOrder } = data.draftOrderCreate;
	if (userErrors.length > 0 || !draftOrder) {
		throw new DraftOrderError(
			'shopify',
			userErrors.map((e) => e.message).join(', ') || 'Draft order creation failed'
		);
	}

	await db
		.update(checkouts)
		.set({
			draftOrderId: draftOrder.id,
			draftOrderName: draftOrder.name,
			draftOrderCreatedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(checkouts.id, checkout.id));

	return draftOrder;
}

/**
 * Flips a cart with a pending draft order to recovered ('draft_order' match).
 * Status-guarded: only an un-recovered cart can flip, so webhook redelivery (or
 * the orders/create race) can never attribute twice.
 */
async function recoverViaDraftOrder(
	shop: string,
	checkout: { id: string; totalPrice: string; currency: string },
	orderId: string,
	totalPrice: string | null,
	currency: string | null
): Promise<void> {
	const amount = totalPrice ?? checkout.totalPrice;
	const updated = await db
		.update(checkouts)
		.set({
			status: 'recovered',
			recoveredAt: new Date(),
			recoveredOrderId: orderId,
			recoveredAmount: amount,
			recoveryMatch: 'draft_order',
			updatedAt: new Date()
		})
		.where(and(eq(checkouts.id, checkout.id), inArray(checkouts.status, ['abandoned', 'alerted'])))
		.returning({ id: checkouts.id });
	if (updated.length === 0) return;

	console.log(`Recovered (draft_order) checkout for ${shop} via order ${orderId}`);
}

/**
 * draft_orders/update with status "completed": the draft order we created has
 * become a real order — attribute the recovery to Cart Radar.
 */
export async function markDraftOrderCompleted(
	shop: string,
	payload: DraftOrderWebhookPayload
): Promise<void> {
	if (payload.status !== 'completed' || !payload.order_id) return;

	const [checkout] = await db
		.select({ id: checkouts.id, totalPrice: checkouts.totalPrice, currency: checkouts.currency })
		.from(checkouts)
		.where(and(eq(checkouts.shop, shop), eq(checkouts.draftOrderId, payload.admin_graphql_api_id)))
		.limit(1);
	if (!checkout) return; // not one of ours

	await recoverViaDraftOrder(
		shop,
		checkout,
		String(payload.order_id),
		payload.total_price ?? null,
		payload.currency ?? null
	);
}

/**
 * orders/create fallback for draft-order recoveries (in case the
 * draft_orders/update webhook is missed): match the order's source_identifier
 * — the draft order's name, e.g. "#D12" — against carts with a pending draft.
 */
export async function attributeDraftOrderBySource(
	shop: string,
	orderId: string,
	sourceIdentifier: string,
	totalPrice: string | null,
	currency: string | null
): Promise<void> {
	const name = sourceIdentifier.startsWith('#') ? sourceIdentifier : `#${sourceIdentifier}`;
	const [checkout] = await db
		.select({ id: checkouts.id, totalPrice: checkouts.totalPrice, currency: checkouts.currency })
		.from(checkouts)
		.where(
			and(
				eq(checkouts.shop, shop),
				eq(checkouts.draftOrderName, name),
				isNotNull(checkouts.draftOrderId)
			)
		)
		.limit(1);
	if (!checkout) return;

	await recoverViaDraftOrder(shop, checkout, orderId, totalPrice, currency);
}
