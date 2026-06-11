/**
 * Alert dispatcher: fans one abandoned checkout out to the shop's configured
 * channels and records every delivery attempt. There are no per-message charges
 * or quotas — Cart Radar bills only on recovered carts (see billing).
 */
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	alerts,
	channelSettings,
	checkouts,
	shops,
	type AlertChannel
} from '$lib/shared/db/schema';
import { getVerifiedDestinations } from '$lib/server/recipients';
import { buildAlertContent, type CheckoutRow } from './format';
import { isEmailConfigured, isSmsConfigured, sendEmail, sendSlack, sendSms } from './channels';

export type DispatchOutcome =
	| { status: 'sent'; sent: number; failed: number }
	| { status: 'all_failed'; failed: number }
	| { status: 'skipped'; reason: 'no_channels' | 'shop_missing' };

export async function dispatchCheckoutAlert(checkout: CheckoutRow): Promise<DispatchOutcome> {
	const [shopRow] = await db.select().from(shops).where(eq(shops.shop, checkout.shop)).limit(1);
	if (!shopRow || shopRow.uninstalledAt) return { status: 'skipped', reason: 'shop_missing' };

	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, checkout.shop))
		.limit(1);
	if (!channels) return { status: 'skipped', reason: 'no_channels' };

	const content = buildAlertContent(checkout);
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

	const smsRecipients = channels.smsEnabled
		? await getVerifiedDestinations(checkout.shop, 'sms')
		: [];
	if (smsRecipients.length > 0 && isSmsConfigured()) {
		for (const phone of smsRecipients) {
			await record('sms', phone, () => sendSms(phone, content.sms));
		}
	}

	if (sent === 0 && failed === 0) return { status: 'skipped', reason: 'no_channels' };

	if (sent > 0) {
		await db
			.update(checkouts)
			.set({ status: 'alerted', alertedAt: new Date(), updatedAt: new Date() })
			.where(eq(checkouts.id, checkout.id));
		return { status: 'sent', sent, failed };
	}

	return { status: 'all_failed', failed };
}

/** Sends a sample alert through the shop's configured channels (no checkout row). */
export async function dispatchTestAlert(
	shop: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
	const [channels] = await db
		.select()
		.from(channelSettings)
		.where(eq(channelSettings.shop, shop))
		.limit(1);
	if (!channels) return { sent: 0, failed: 0, errors: ['No channels configured yet'] };

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
		if (isSmsConfigured()) {
			for (const phone of smsRecipients) {
				await attempt('sms', phone, () => sendSms(phone, content.sms));
			}
		} else {
			errors.push('sms: server SMS sending is not configured');
		}
	}

	return { sent, failed, errors };
}
