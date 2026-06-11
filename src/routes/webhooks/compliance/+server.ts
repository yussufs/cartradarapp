import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import {
	session as sessionTable,
	shops,
	alertRules,
	alertRecipients,
	channelSettings,
	checkouts,
	alerts,
	usageCharges
} from '$lib/shared/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Compliance webhook payloads
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */
interface CustomerDataRequestPayload {
	shop_id: number;
	shop_domain: string;
	customer: { id: number; email: string; phone?: string };
	orders_requested: number[];
	data_request: { id: number };
}

interface CustomerRedactPayload {
	shop_id: number;
	shop_domain: string;
	customer: { id: number; email: string; phone?: string };
	orders_to_redact: number[];
}

interface ShopRedactPayload {
	shop_id: number;
	shop_domain: string;
}

type CompliancePayload = CustomerDataRequestPayload | CustomerRedactPayload | ShopRedactPayload;

export const POST: RequestHandler = async ({ request }) => {
	const { shop, topic, payload } = await authenticateWebhook<CompliancePayload>(request);

	try {
		switch (topic) {
			case 'customers/data_request': {
				const p = payload as CustomerDataRequestPayload;
				// We only hold checkout snapshots; log what we have so the request can be
				// fulfilled manually within the 30-day window.
				const rows = await db
					.select({ id: checkouts.id, createdAt: checkouts.checkoutCreatedAt })
					.from(checkouts)
					.where(and(eq(checkouts.shop, shop), eq(checkouts.customerEmail, p.customer.email)));
				console.log(
					`Customer data request #${p.data_request.id} for ${shop}: ` +
						`${rows.length} checkout snapshot(s) held for ${p.customer.email}`
				);
				break;
			}

			case 'customers/redact': {
				const p = payload as CustomerRedactPayload;
				// Null out PII on checkout snapshots for this customer
				await db
					.update(checkouts)
					.set({ customerName: null, customerEmail: null, customerPhone: null })
					.where(and(eq(checkouts.shop, shop), eq(checkouts.customerEmail, p.customer.email)));
				console.log(`Redacted checkout PII for customer ${p.customer.id} on ${shop}`);
				break;
			}

			case 'shop/redact': {
				console.log(`Shop redact request for ${shop} - deleting all shop data`);
				await db.delete(alerts).where(eq(alerts.shop, shop));
				await db.delete(checkouts).where(eq(checkouts.shop, shop));
				await db.delete(usageCharges).where(eq(usageCharges.shop, shop));
				await db.delete(alertRules).where(eq(alertRules.shop, shop));
				await db.delete(alertRecipients).where(eq(alertRecipients.shop, shop));
				await db.delete(channelSettings).where(eq(channelSettings.shop, shop));
				await db.delete(shops).where(eq(shops.shop, shop));
				await db.delete(sessionTable).where(eq(sessionTable.shop, shop));
				console.log(`Successfully deleted all data for shop ${shop}`);
				break;
			}

			default:
				console.log(`Unknown compliance topic: ${topic}`);
		}
	} catch (err) {
		console.error(`Error processing ${topic} webhook:`, err);
	}

	return new Response();
};
