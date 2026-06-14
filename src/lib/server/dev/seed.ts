/**
 * Local testing harness: synthesise abandoned checkouts (and recoveries) so the
 * full alert funnel can be exercised in seconds instead of waiting out the
 * inactivity window. Seeded checkouts use a recognisable token prefix so they
 * can be cleaned up without touching real data.
 *
 * Guarded by DEV_TOOLS — see guard.ts. Never reachable in production.
 */
import crypto from 'crypto';
import { and, eq, like } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	alertRecipients,
	alertRules,
	channelSettings,
	checkouts,
	type LineItemSnapshot
} from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { getOfflineSession } from '$lib/server/shopify/auth';
import { createAdmin, throwOnErrors, type AdminClient } from '$lib/server/shopify/graphql';

const SEED_TOKEN_PREFIX = 'seed-';

function syntheticItem(total: number): LineItemSnapshot {
	return {
		title: 'Seeded test product',
		quantity: 1,
		price: total.toFixed(2),
		variantTitle: null,
		sku: null,
		variantId: null
	};
}

/**
 * Pulls real catalog products (with their first variant's numeric ID) so seeded
 * carts mirror the store and draft-order recovery works. Returns null if the
 * store has no usable products. Requires the read_products scope.
 */
async function fetchStoreLineItems(admin: AdminClient): Promise<LineItemSnapshot[] | null> {
	const response = await admin.graphql<{
		products: {
			nodes: Array<{
				title: string;
				variants: {
					nodes: Array<{ id: string; title: string; price: string; sku: string | null }>;
				};
			}>;
		};
	}>(
		`#graphql
		query DevSeedProducts($count: Int!) {
			products(first: $count, query: "status:active") {
				nodes {
					title
					variants(first: 1) {
						nodes {
							id
							title
							price
							sku
						}
					}
				}
			}
		}`,
		{ variables: { count: 10 } }
	);

	const data = throwOnErrors(response);
	const items: LineItemSnapshot[] = [];
	for (const product of data.products.nodes) {
		const variant = product.variants.nodes[0];
		if (!variant) continue;
		const price = parseFloat(variant.price);
		if (!isFinite(price) || price <= 0) continue;
		const variantId = Number(variant.id.split('/').pop());
		if (!Number.isFinite(variantId)) continue;
		items.push({
			title: product.title,
			quantity: 1,
			price: variant.price,
			variantTitle: variant.title && variant.title !== 'Default Title' ? variant.title : null,
			sku: variant.sku ?? null,
			variantId
		});
	}
	return items.length > 0 ? items : null;
}

interface SeedOptions {
	/** Cart total. Bumped above the rule threshold if needed so it qualifies. */
	total?: number;
	/** How long ago the cart went quiet. Default 180 min — past any window. */
	ageMinutes?: number;
	email?: string;
	customerName?: string;
}

export interface SeedResult {
	id: string;
	token: string;
	total: string;
	itemCount: number;
	usedRealProducts: boolean;
}

/**
 * Inserts an `active` checkout that already satisfies an enabled rule (high
 * total, backdated lastActivityAt), plus the rule/channel/recipient it needs to
 * actually alert. The scheduler picks it up on its next tick, or call the
 * evaluator directly for an instant result.
 */
export async function seedAbandonedCheckout(
	shop: string,
	opts: SeedOptions = {}
): Promise<SeedResult> {
	await ensureShopRow(shop);

	// Ensure an enabled rule exists; create a permissive one if the shop has none.
	const [rule] = await db.select().from(alertRules).where(eq(alertRules.shop, shop)).limit(1);
	let threshold = 1;
	let inactivityMinutes = 60;
	if (rule) {
		threshold = parseFloat(rule.thresholdAmount);
		inactivityMinutes = rule.inactivityMinutes;
		if (!rule.enabled) {
			await db.update(alertRules).set({ enabled: true }).where(eq(alertRules.id, rule.id));
		}
	} else {
		await db
			.insert(alertRules)
			.values({ shop, enabled: true, thresholdAmount: '1.00', inactivityMinutes: 60 });
	}

	// Ensure an enabled email channel + a verified recipient so alerts land somewhere.
	const email = opts.email ?? 'dev@example.com';
	await db
		.insert(channelSettings)
		.values({ shop, emailEnabled: true })
		.onConflictDoUpdate({
			target: channelSettings.shop,
			set: { emailEnabled: true, updatedAt: new Date() }
		});
	await db
		.insert(alertRecipients)
		.values({ shop, channel: 'email', destination: email, verified: true })
		.onConflictDoUpdate({
			target: [alertRecipients.shop, alertRecipients.channel, alertRecipients.destination],
			set: { verified: true }
		});

	const target = Math.max(opts.total ?? 750, threshold + 1);

	// Use real catalog products when we can (so draft-order recovery works);
	// fall back to a synthetic item if read_products isn't granted or the store
	// has no products.
	let lineItems: LineItemSnapshot[];
	let usedRealProducts = false;
	try {
		const admin = createAdmin(await getOfflineSession(shop));
		const realItems = await fetchStoreLineItems(admin);
		if (realItems) {
			lineItems = realItems;
			usedRealProducts = true;
		} else {
			lineItems = [syntheticItem(target)];
		}
	} catch (err) {
		console.warn(
			`[dev seed] product lookup failed for ${shop} (need read_products + re-auth?), using a synthetic item:`,
			err instanceof Error ? err.message : err
		);
		lineItems = [syntheticItem(target)];
	}

	// Bump the first item's quantity so the cart clears the rule threshold/target.
	const sum = () => lineItems.reduce((s, li) => s + parseFloat(li.price) * li.quantity, 0);
	let total = sum();
	const unit = parseFloat(lineItems[0].price);
	if (total < target && unit > 0) {
		lineItems[0].quantity += Math.ceil((target - total) / unit);
		total = sum();
	}
	const itemCount = lineItems.reduce((s, li) => s + li.quantity, 0);
	const totalStr = total.toFixed(2);

	// Backdate past the rule's window (+5 min buffer) so it qualifies immediately,
	// honouring a larger explicit age if the caller wants an older cart.
	const ageMinutes = Math.max(opts.ageMinutes ?? 180, inactivityMinutes + 5);
	const lastActivityAt = new Date(Date.now() - ageMinutes * 60_000);
	const token = `${SEED_TOKEN_PREFIX}${crypto.randomUUID()}`;

	const [created] = await db
		.insert(checkouts)
		.values({
			shop,
			checkoutToken: token,
			shopifyCheckoutId: null,
			abandonedCheckoutUrl: null,
			totalPrice: totalStr,
			currency: 'USD',
			itemCount,
			customerName: opts.customerName ?? 'Dev Tester',
			customerEmail: email,
			lineItems,
			status: 'active',
			checkoutCreatedAt: lastActivityAt,
			lastActivityAt,
			updatedAt: new Date()
		})
		.returning({ id: checkouts.id });

	return { id: created.id, token, total: totalStr, itemCount, usedRealProducts };
}

/** Flips a seeded (or real) non-terminal checkout to recovered, as a token match. */
export async function simulateRecovery(
	shop: string,
	checkoutId: string,
	amount?: number
): Promise<boolean> {
	const [row] = await db
		.select({ totalPrice: checkouts.totalPrice })
		.from(checkouts)
		.where(and(eq(checkouts.shop, shop), eq(checkouts.id, checkoutId)))
		.limit(1);
	if (!row) return false;

	const recoveredAmount = (amount ?? parseFloat(row.totalPrice)).toFixed(2);
	const updated = await db
		.update(checkouts)
		.set({
			status: 'recovered',
			recoveredAt: new Date(),
			recoveredOrderId: `seed-order-${crypto.randomUUID()}`,
			recoveredAmount,
			recoveryMatch: 'token',
			updatedAt: new Date()
		})
		.where(and(eq(checkouts.shop, shop), eq(checkouts.id, checkoutId)))
		.returning({ id: checkouts.id });
	return updated.length > 0;
}

/** Deletes all seeded checkouts for a shop (alerts cascade). Returns the count. */
export async function resetSeeded(shop: string): Promise<number> {
	const deleted = await db
		.delete(checkouts)
		.where(and(eq(checkouts.shop, shop), like(checkouts.checkoutToken, `${SEED_TOKEN_PREFIX}%`)))
		.returning({ id: checkouts.id });
	return deleted.length;
}
