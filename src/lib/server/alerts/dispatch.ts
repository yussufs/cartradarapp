/**
 * Alert dispatcher: fans one abandoned checkout out to the shop's configured
 * channels, enforcing plan quotas and recording every delivery attempt.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	alerts,
	channelSettings,
	checkouts,
	shops,
	type AlertChannel
} from '$lib/shared/db/schema';
import { PLANS, PERIOD_DAYS } from '$lib/server/billing/plans';
import { recordSmsOverage } from '$lib/server/billing/subscriptions';
import { smsZoneForNumber } from '$lib/server/billing/sms-zones';
import { getVerifiedDestinations } from '$lib/server/recipients';
import { buildAlertContent, type CheckoutRow } from './format';
import { isEmailConfigured, isSmsConfigured, sendEmail, sendSlack, sendSms } from './channels';

export type DispatchOutcome =
	| { status: 'sent'; sent: number; failed: number }
	| { status: 'all_failed'; failed: number }
	| { status: 'skipped'; reason: 'quota_exceeded' | 'no_channels' | 'shop_missing' };

type ShopRow = typeof shops.$inferSelect;

/** Lazily roll the 30-day usage period forward when it has elapsed. */
async function resetPeriodIfNeeded(shopRow: ShopRow): Promise<ShopRow> {
	const periodMs = PERIOD_DAYS * 24 * 60 * 60 * 1000;
	if (Date.now() - shopRow.periodStartedAt.getTime() < periodMs) return shopRow;

	const now = new Date();
	const reset = {
		alertsUsedThisPeriod: 0,
		smsUsedThisPeriod: 0,
		domesticSmsUsedThisPeriod: 0,
		periodStartedAt: now
	};
	await db.update(shops).set(reset).where(eq(shops.shop, shopRow.shop));
	return { ...shopRow, ...reset };
}

export async function dispatchCheckoutAlert(checkout: CheckoutRow): Promise<DispatchOutcome> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, checkout.shop)).limit(1);
	if (!shopRow || shopRow.uninstalledAt) return { status: 'skipped', reason: 'shop_missing' };

	const current = await resetPeriodIfNeeded(shopRow);
	const plan = PLANS[current.plan];

	if (plan.alertLimit !== null && current.alertsUsedThisPeriod >= plan.alertLimit) {
		// Leave the checkout in 'abandoned' — the dashboard surfaces these as missed alerts
		console.log(`Quota exceeded for ${checkout.shop} (${plan.plan}); skipping alert`);
		return { status: 'skipped', reason: 'quota_exceeded' };
	}

	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, checkout.shop))
		.limit(1);
	if (!channels) return { status: 'skipped', reason: 'no_channels' };

	const content = buildAlertContent(checkout);
	const smsAllowed = plan.smsPricing !== null;
	let sent = 0;
	let failed = 0;

	const record = async (
		channel: AlertChannel,
		recipient: string | null,
		send: () => Promise<string | null>
	) => {
		try {
			const providerMessageId = await send();
			await db.insert(alerts).values({
				shop: checkout.shop,
				checkoutId: checkout.id,
				channel,
				recipient,
				status: 'sent',
				providerMessageId,
				sentAt: new Date()
			});
			sent++;
			return true;
		} catch (err) {
			console.error(`Alert ${channel} failed for ${checkout.shop}:`, err);
			await db.insert(alerts).values({
				shop: checkout.shop,
				checkoutId: checkout.id,
				channel,
				recipient,
				status: 'failed',
				error: err instanceof Error ? err.message : String(err)
			});
			failed++;
			return false;
		}
	};

	const emailRecipients = channels.emailEnabled
		? await getVerifiedDestinations(checkout.shop, 'email')
		: [];
	if (emailRecipients.length > 0 && isEmailConfigured()) {
		await record('email', emailRecipients.join(', '), () => sendEmail(emailRecipients, content));
	}

	if (channels.slackEnabled && channels.slackWebhookUrl) {
		const webhookUrl = channels.slackWebhookUrl;
		await record('slack', 'slack', () => sendSlack(webhookUrl, content.slackPayload));
	}

	// SMS: zoned. Domestic (US/CA) draws down the included allowance; everything
	// over the allowance, plus every international message, is billed by zone.
	let smsSent = 0;
	let domesticIncludedConsumed = 0;
	let billableAmount = 0;
	let billableDomestic = 0;
	let billableInternational = 0;
	const pricing = plan.smsPricing;
	const smsRecipients =
		smsAllowed && pricing && channels.smsEnabled
			? await getVerifiedDestinations(checkout.shop, 'sms')
			: [];
	if (smsRecipients.length > 0 && pricing && isSmsConfigured()) {
		let domesticConsumed = current.domesticSmsUsedThisPeriod;
		for (const phone of smsRecipients) {
			const ok = await record('sms', phone, () => sendSms(phone, content.sms));
			if (!ok) continue;
			smsSent++;
			if (smsZoneForNumber(phone) === 'domestic') {
				if (domesticConsumed < plan.includedSms) {
					domesticConsumed++;
					domesticIncludedConsumed++;
				} else {
					billableDomestic++;
					billableAmount += pricing.domestic;
				}
			} else {
				billableInternational++;
				billableAmount += pricing.international;
			}
		}
	}

	if (sent === 0 && failed === 0) return { status: 'skipped', reason: 'no_channels' };

	if (sent > 0) {
		await db
			.update(shops)
			.set({
				alertsUsedThisPeriod: sql`${shops.alertsUsedThisPeriod} + 1`,
				smsUsedThisPeriod: sql`${shops.smsUsedThisPeriod} + ${smsSent}`,
				domesticSmsUsedThisPeriod: sql`${shops.domesticSmsUsedThisPeriod} + ${domesticIncludedConsumed}`
			})
			.where(eq(shops.shop, checkout.shop));

		// Bill SMS beyond the included (domestic) allowance, priced by zone
		if (billableAmount > 0) {
			const parts = [
				billableDomestic > 0 ? `${billableDomestic} US/Canada` : null,
				billableInternational > 0 ? `${billableInternational} international` : null
			].filter(Boolean);
			await recordSmsOverage(
				checkout.shop,
				checkout.id,
				billableAmount.toFixed(2),
				`SMS alerts beyond included volume (${parts.join(', ')})`
			);
		}

		await db
			.update(checkouts)
			.set({ status: 'alerted', alertedAt: new Date(), updatedAt: new Date() })
			.where(eq(checkouts.id, checkout.id));

		return { status: 'sent', sent, failed };
	}

	return { status: 'all_failed', failed };
}

/** Sends a sample alert through the shop's configured channels (no quota, no checkout row). */
export async function dispatchTestAlert(
	shop: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, shop))
		.limit(1);
	if (!channels) return { sent: 0, failed: 0, errors: ['No channels configured yet'] };

	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
	const plan = PLANS[shopRow?.plan ?? 'free'];
	const smsAllowed = plan.smsPricing !== null;

	const sample: CheckoutRow = {
		id: '00000000-0000-0000-0000-000000000000',
		shop,
		checkoutToken: 'test',
		shopifyCheckoutId: null,
		abandonedCheckoutUrl: null,
		totalPrice: '1249.00',
		currency: 'USD',
		itemCount: 3,
		customerName: 'Test Customer',
		customerEmail: 'customer@example.com',
		customerPhone: '+1 555 010 1234',
		lineItems: [
			{ title: 'Sample product A', quantity: 2, price: '499.50', variantTitle: 'Large', sku: null },
			{ title: 'Sample product B', quantity: 1, price: '250.00', variantTitle: null, sku: null }
		],
		status: 'abandoned',
		checkoutCreatedAt: new Date(),
		lastActivityAt: new Date(),
		alertedAt: null,
		recoveredAt: null,
		recoveredOrderId: null,
		recoveredAmount: null,
		recoveryMatch: null,
		updatedAt: new Date()
	};

	const content = buildAlertContent(sample);
	content.subject = `[Test] ${content.subject}`;
	content.sms = `[Test] ${content.sms}`;

	let sent = 0;
	let failed = 0;
	const errors: string[] = [];

	const attempt = async (
		channel: AlertChannel,
		recipient: string | null,
		send: () => Promise<string | null>
	) => {
		try {
			const providerMessageId = await send();
			await db.insert(alerts).values({
				shop,
				channel,
				recipient,
				status: 'sent',
				providerMessageId,
				isTest: true,
				sentAt: new Date()
			});
			sent++;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push(`${channel}: ${message}`);
			await db
				.insert(alerts)
				.values({ shop, channel, recipient, status: 'failed', error: message, isTest: true });
			failed++;
		}
	};

	const emailRecipients = await getVerifiedDestinations(shop, 'email');
	if (channels.emailEnabled && emailRecipients.length > 0) {
		if (isEmailConfigured()) {
			await attempt('email', emailRecipients.join(', '), () => sendEmail(emailRecipients, content));
		} else {
			errors.push('email: server email sending is not configured');
		}
	}

	if (channels.slackEnabled && channels.slackWebhookUrl) {
		const webhookUrl = channels.slackWebhookUrl;
		await attempt('slack', 'slack', () => sendSlack(webhookUrl, content.slackPayload));
	}

	const smsRecipients = await getVerifiedDestinations(shop, 'sms');
	if (channels.smsEnabled && smsRecipients.length > 0) {
		if (!smsAllowed) {
			errors.push('sms: SMS alerts require a paid plan');
		} else if (isSmsConfigured()) {
			for (const phone of smsRecipients) {
				await attempt('sms', phone, () => sendSms(phone, content.sms));
			}
		} else {
			errors.push('sms: server SMS sending is not configured');
		}
	}

	return { sent, failed, errors };
}
