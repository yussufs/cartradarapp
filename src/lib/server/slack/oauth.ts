/**
 * Slack "Connect Slack" OAuth (incoming-webhook scope). The merchant clicks one
 * button, picks a channel on Slack's own screen, and we receive a channel
 * webhook URL — no manual app creation. Mirrors the cookie-free pattern used
 * elsewhere: CSRF is an HMAC-signed `state` (keyed on SHOPIFY_API_SECRET) that
 * carries the shop, since the OAuth callback has no Shopify session.
 *
 * Slack app setup (one-time): create an app at api.slack.com/apps, add the
 * `incoming-webhook` scope, and register the redirect URL returned by
 * slackRedirectUri() (i.e. <SHOPIFY_APP_URL>/auth/slack/callback). Put the
 * client id/secret in SLACK_CLIENT_ID / SLACK_CLIENT_SECRET.
 */
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const STATE_TTL_MS = 10 * 60 * 1000; // signed state is valid for 10 minutes

export function isSlackConfigured(): boolean {
	return !!(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
}

function signingKey(): string {
	const key = env.SHOPIFY_API_SECRET;
	if (!key) throw new Error('SHOPIFY_API_SECRET is required to sign Slack OAuth state');
	return key;
}

function appBaseUrl(): string {
	const url = env.SHOPIFY_APP_URL || env.HOST;
	if (!url) throw new Error('SHOPIFY_APP_URL or HOST is required for Slack OAuth');
	return url.replace(/\/+$/, '');
}

/** The redirect URL to register in the Slack app's OAuth settings. */
export function slackRedirectUri(): string {
	return `${appBaseUrl()}/auth/slack/callback`;
}

function hmac(payload: string): string {
	return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

/** Signs an opaque, tamper-proof state that pins this OAuth flow to one shop. */
export function signState(shop: string): string {
	const payload = Buffer.from(
		JSON.stringify({ shop, nonce: crypto.randomBytes(8).toString('hex'), iat: Date.now() })
	).toString('base64url');
	return `${payload}.${hmac(payload)}`;
}

/** Returns the shop if the state is authentic and unexpired, else null. */
export function verifyState(state: string): string | null {
	const [payload, sig] = state.split('.');
	if (!payload || !sig) return null;

	const expected = hmac(payload);
	if (
		sig.length !== expected.length ||
		!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
	) {
		return null;
	}

	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
		if (typeof data.shop !== 'string' || typeof data.iat !== 'number') return null;
		if (Date.now() - data.iat > STATE_TTL_MS) return null;
		return data.shop;
	} catch {
		return null;
	}
}

export function buildAuthorizeUrl(shop: string): string {
	const params = new URLSearchParams({
		client_id: env.SLACK_CLIENT_ID ?? '',
		scope: 'incoming-webhook',
		redirect_uri: slackRedirectUri(),
		state: signState(shop)
	});
	return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface SlackConnection {
	webhookUrl: string;
	channelName: string;
	teamName: string | null;
}

/** Exchanges the OAuth code for a channel webhook URL via oauth.v2.access. */
export async function exchangeCode(code: string): Promise<SlackConnection> {
	const response = await fetch('https://slack.com/api/oauth.v2.access', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.SLACK_CLIENT_ID ?? '',
			client_secret: env.SLACK_CLIENT_SECRET ?? '',
			code,
			redirect_uri: slackRedirectUri()
		})
	});

	const data = (await response.json()) as {
		ok: boolean;
		error?: string;
		team?: { name?: string };
		incoming_webhook?: { url?: string; channel?: string };
	};

	if (!data.ok || !data.incoming_webhook?.url) {
		throw new Error(`Slack OAuth exchange failed: ${data.error ?? 'no webhook returned'}`);
	}

	return {
		webhookUrl: data.incoming_webhook.url,
		channelName: data.incoming_webhook.channel ?? 'your channel',
		teamName: data.team?.name ?? null
	};
}
