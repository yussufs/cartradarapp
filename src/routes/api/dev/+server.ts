/**
 * Local testing harness API (dev only — gated by DEV_TOOLS). Drives the alert
 * funnel without waiting on Shopify or the inactivity window.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { shops } from '$lib/shared/db/schema';
import { assertDevTools } from '$lib/server/dev/guard';
import { resetSeeded, seedAbandonedCheckout, simulateRecovery } from '$lib/server/dev/seed';
import { evaluateAbandonedCheckouts } from '$lib/server/jobs/evaluate';

interface DevBody {
	action?: string;
	checkoutId?: string;
	total?: number;
	ageMinutes?: number;
	amount?: number;
	plan?: 'free' | 'pro';
}

export const POST: RequestHandler = async ({ request }) => {
	assertDevTools();

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

	let body: DevBody;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	switch (body.action) {
		case 'seed': {
			const result = await seedAbandonedCheckout(shop, {
				total: body.total,
				ageMinutes: body.ageMinutes
			});
			return json({ ok: true, ...result });
		}
		case 'evaluate': {
			const alerted = await evaluateAbandonedCheckouts();
			return json({ ok: true, alerted });
		}
		case 'recover': {
			if (!body.checkoutId) return json({ error: 'checkoutId is required' }, { status: 422 });
			const recovered = await simulateRecovery(shop, body.checkoutId, body.amount);
			return json({ ok: recovered });
		}
		case 'set-plan': {
			const billingActive = body.plan === 'pro';
			await db.update(shops).set({ billingActive }).where(eq(shops.shop, shop));
			return json({ ok: true, plan: billingActive ? 'pro' : 'free' });
		}
		case 'reset': {
			const deleted = await resetSeeded(shop);
			return json({ ok: true, deleted });
		}
		default:
			return json({ error: 'Unknown action' }, { status: 422 });
	}
};
