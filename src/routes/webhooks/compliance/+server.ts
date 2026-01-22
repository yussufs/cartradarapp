import type { RequestHandler } from './$types';
import { authenticateWebhook } from '$lib/server/shopify/webhooks';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/shared/db/schema';
import { eq } from 'drizzle-orm';

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
				console.log(`Customer data request #${p.data_request.id} for shop ${shop}`);
				console.log(`Customer ID: ${p.customer.id}, Email: ${p.customer.email}`);
				// TODO: Query your database for any data associated with this customer
				// and provide it to the store owner (via email, admin panel, etc.)
				// You have 30 days to comply with this request
				break;
			}

			case 'customers/redact': {
				const p = payload as CustomerRedactPayload;
				console.log(`Customer redact request for shop ${shop}`);
				console.log(`Customer ID: ${p.customer.id}, Email: ${p.customer.email}`);
				// TODO: Delete or anonymize any personal data for this customer
				console.log(`Deleted customer data for customer ${p.customer.id}`);
				break;
			}

			case 'shop/redact': {
				console.log(`Shop redact request for ${shop} - deleting all shop data`);
				await db.delete(sessionTable).where(eq(sessionTable.shop, shop));
				// TODO: Delete from additional tables as your app grows
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
