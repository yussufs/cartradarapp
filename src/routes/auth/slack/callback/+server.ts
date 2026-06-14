/**
 * Slack OAuth callback (public — Slack redirects the top-level browser here, so
 * there's no Shopify session). The signed `state` carries and proves the shop.
 * On success we store the channel webhook and bounce back into the embedded app.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { channelSettings } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { exchangeCode, verifyState } from '$lib/server/slack/oauth';
import { adminAppUrl } from '$lib/server/alerts/format';

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const oauthError = url.searchParams.get('error');

	const shop = state ? verifyState(state) : null;
	if (!shop) {
		// Can't trust which shop this is — refuse rather than guess.
		return new Response(
			'Invalid or expired Slack authorization. Please try connecting again from the app.',
			{ status: 400 }
		);
	}

	const settingsUrl = adminAppUrl(shop, '/app/settings');

	// Merchant denied, or Slack returned an error.
	if (oauthError || !code) {
		redirect(303, `${settingsUrl}?slack=denied`);
	}

	// redirect() throws, so compute the target inside try/catch and redirect after.
	let target = `${settingsUrl}?slack=connected`;
	try {
		const connection = await exchangeCode(code);
		await ensureShopRow(shop);
		const values = {
			slackEnabled: true,
			slackWebhookUrl: connection.webhookUrl,
			slackChannelName: connection.channelName,
			updatedAt: new Date()
		};
		await db
			.insert(channelSettings)
			.values({ shop, ...values })
			.onConflictDoUpdate({ target: channelSettings.shop, set: values });
	} catch (err) {
		console.error(`Slack OAuth callback failed for ${shop}:`, err);
		target = `${settingsUrl}?slack=error`;
	}

	redirect(303, target);
};
