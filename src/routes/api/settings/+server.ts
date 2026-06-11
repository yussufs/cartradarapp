import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { authenticateRequest, AuthError } from '$lib/server/shopify/auth';
import { db } from '$lib/server/db';
import { alertRules, channelSettings, shops } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { PLANS } from '$lib/server/billing/plans';

interface SettingsBody {
	rule: {
		enabled: boolean;
		thresholdAmount: number;
		minItemCount: number | null;
		inactivityMinutes: number;
	};
	attributionWindowDays: number;
	channels: {
		emailEnabled: boolean;
		slackEnabled: boolean;
		slackWebhookUrl: string | null;
		smsEnabled: boolean;
	};
}

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

export const GET: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	await ensureShopRow(shop);
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	const [rule] = await db.select().from(alertRules).where(eq(alertRules.shop, shop)).limit(1);
	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, shop))
		.limit(1);

	const plan = PLANS[shopRow.plan];

	return json({
		rule: rule
			? {
					enabled: rule.enabled,
					thresholdAmount: parseFloat(rule.thresholdAmount),
					minItemCount: rule.minItemCount,
					inactivityMinutes: rule.inactivityMinutes
				}
			: { enabled: false, thresholdAmount: 500, minItemCount: null, inactivityMinutes: 60 },
		attributionWindowDays: shopRow.attributionWindowDays,
		channels: channels
			? {
					emailEnabled: channels.emailEnabled,
					slackEnabled: channels.slackEnabled,
					slackWebhookUrl: channels.slackWebhookUrl,
					smsEnabled: channels.smsEnabled
				}
			: { emailEnabled: true, slackEnabled: false, slackWebhookUrl: null, smsEnabled: false },
		plan: {
			plan: shopRow.plan,
			alertsUsed: shopRow.alertsUsedThisPeriod,
			alertLimit: plan.alertLimit,
			smsUsed: shopRow.smsUsedThisPeriod,
			includedSms: plan.includedSms,
			smsAvailable: plan.smsPricing !== null,
			smsPricing: plan.smsPricing
		},
		currency: shopRow.currency ?? 'USD'
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const { shop, response } = await authenticate(request);
	if (!shop) return response!;

	let body: SettingsBody;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const errors: string[] = [];
	const threshold = Number(body.rule?.thresholdAmount);
	if (!isFinite(threshold) || threshold <= 0) {
		errors.push('Threshold must be a positive amount');
	}
	const inactivity = Number(body.rule?.inactivityMinutes);
	if (!Number.isInteger(inactivity) || inactivity < 15 || inactivity > 1440) {
		errors.push('Inactivity window must be between 15 minutes and 24 hours');
	}
	const minItemCount =
		body.rule?.minItemCount === null || body.rule?.minItemCount === undefined
			? null
			: Number(body.rule.minItemCount);
	if (minItemCount !== null && (!Number.isInteger(minItemCount) || minItemCount < 1)) {
		errors.push('Minimum item count must be a whole number of at least 1');
	}

	const attributionWindowDays = Number(body.attributionWindowDays);
	if (
		!Number.isInteger(attributionWindowDays) ||
		attributionWindowDays < 1 ||
		attributionWindowDays > 90
	) {
		errors.push('Attribution window must be between 1 and 90 days');
	}

	const slackWebhookUrl = body.channels?.slackWebhookUrl?.trim() || null;
	if (body.channels?.slackEnabled && !slackWebhookUrl?.startsWith('https://hooks.slack.com/')) {
		errors.push('Slack webhook URL must start with https://hooks.slack.com/');
	}

	if (errors.length > 0) return json({ errors }, { status: 422 });

	await ensureShopRow(shop);
	await db.update(shops).set({ attributionWindowDays }).where(eq(shops.shop, shop));

	// v1: one rule per shop (Scale's multi-rule support comes later)
	const [existingRule] = await db
		.select({ id: alertRules.id })
		.from(alertRules)
		.where(eq(alertRules.shop, shop))
		.limit(1);
	const ruleValues = {
		enabled: !!body.rule.enabled,
		thresholdAmount: threshold.toFixed(2),
		minItemCount,
		inactivityMinutes: inactivity
	};
	if (existingRule) {
		await db.update(alertRules).set(ruleValues).where(eq(alertRules.id, existingRule.id));
	} else {
		await db.insert(alertRules).values({ shop, ...ruleValues });
	}

	const channelValues = {
		emailEnabled: !!body.channels.emailEnabled,
		slackEnabled: !!body.channels.slackEnabled,
		slackWebhookUrl,
		smsEnabled: !!body.channels.smsEnabled,
		updatedAt: new Date()
	};
	await db
		.insert(channelSettings)
		.values({ shop, ...channelValues })
		.onConflictDoUpdate({ target: channelSettings.shop, set: channelValues });

	return json({ ok: true });
};
