import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { alerts, checkouts } from '$lib/shared/db/schema';

export const GET: RequestHandler = async ({ request, params }) => {
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

	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	// Scope by shop so one merchant can never read another's checkout
	const [checkout] = await db
		.select()
		.from(checkouts)
		.where(and(eq(checkouts.id, params.id), eq(checkouts.shop, shop)))
		.limit(1);
	if (!checkout) return json({ error: 'Not found' }, { status: 404 });

	const alertHistory = await db
		.select({
			id: alerts.id,
			channel: alerts.channel,
			recipient: alerts.recipient,
			status: alerts.status,
			error: alerts.error,
			sentAt: alerts.sentAt,
			createdAt: alerts.createdAt
		})
		.from(alerts)
		.where(eq(alerts.checkoutId, checkout.id))
		.orderBy(desc(alerts.createdAt));

	return json({ checkout, alerts: alertHistory });
};
