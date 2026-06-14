/**
 * Alert recipient management: add an email address, send it a confirmation
 * LINK, and verify when the recipient clicks it. A link (rather than a typed
 * code) works for shared/staff inboxes the merchant can't read a code out of.
 *
 * Nothing is ever sent to an unconfirmed address — clicking the link proves the
 * recipient controls the inbox and protects deliverability.
 */
import crypto from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { alertRecipients, type RecipientChannel } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import { isEmailConfigured, sendEmail } from '$lib/server/alerts/channels';

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // confirmation links are valid 7 days
const RESEND_COOLDOWN_MS = 30 * 1000; // at most one link every 30 seconds

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientRow = typeof alertRecipients.$inferSelect;

/** Public shape — never leaks the verification token. */
export interface RecipientView {
	id: string;
	channel: RecipientChannel;
	destination: string;
	verified: boolean;
	canResend: boolean;
}

export class RecipientError extends Error {
	constructor(
		message: string,
		readonly status = 400
	) {
		super(message);
		this.name = 'RecipientError';
	}
}

function generateToken(): string {
	return crypto.randomBytes(32).toString('base64url');
}

function appBaseUrl(): string {
	const url = env.SHOPIFY_APP_URL || env.HOST;
	if (!url) throw new RecipientError('App URL is not configured on the server', 500);
	return url.replace(/\/+$/, '');
}

function canResend(row: Pick<RecipientRow, 'verificationSentAt'>): boolean {
	if (!row.verificationSentAt) return true;
	return Date.now() - row.verificationSentAt.getTime() >= RESEND_COOLDOWN_MS;
}

function toView(row: RecipientRow): RecipientView {
	return {
		id: row.id,
		channel: row.channel,
		destination: row.destination,
		verified: row.verified,
		canResend: !row.verified && canResend(row)
	};
}

function normalize(raw: string): string {
	const lowered = raw.trim().toLowerCase();
	if (!EMAIL_RE.test(lowered)) throw new RecipientError('Enter a valid email address');
	return lowered;
}

async function sendVerificationLink(destination: string, token: string): Promise<void> {
	if (!isEmailConfigured()) {
		throw new RecipientError('Email sending is not configured on the server yet', 503);
	}
	const link = `${appBaseUrl()}/auth/recipient/verify?token=${token}`;
	await sendEmail([destination], {
		subject: 'Confirm your email for Cart Radar alerts',
		text:
			`Confirm this address to start receiving Cart Radar cart alerts:\n${link}\n\n` +
			`This link expires in 7 days. If you didn't expect this, you can ignore this email.`,
		html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;">
			<p style="font-size:14px;color:#6d7175;margin:0 0 8px;">Cart Radar</p>
			<p style="margin:0 0 16px;">Confirm <strong>${destination}</strong> to start receiving high-value cart alerts:</p>
			<p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Confirm email</a></p>
			<p style="font-size:13px;color:#6d7175;margin:0;">Or paste this link into your browser:<br>${link}</p>
			<p style="font-size:13px;color:#6d7175;margin:16px 0 0;">This link expires in 7 days. If you didn't expect this, you can ignore this email.</p>
		</div>`
	});
}

export async function listRecipients(shop: string): Promise<RecipientView[]> {
	const rows = await db
		.select()
		.from(alertRecipients)
		.where(eq(alertRecipients.shop, shop))
		.orderBy(asc(alertRecipients.channel), asc(alertRecipients.createdAt));
	return rows.map(toView);
}

/** Verified destinations for one channel — used by the dispatcher. */
export async function getVerifiedDestinations(
	shop: string,
	channel: RecipientChannel
): Promise<string[]> {
	const rows = await db
		.select({ destination: alertRecipients.destination })
		.from(alertRecipients)
		.where(
			and(
				eq(alertRecipients.shop, shop),
				eq(alertRecipients.channel, channel),
				eq(alertRecipients.verified, true)
			)
		);
	return rows.map((r) => r.destination);
}

export async function hasVerifiedRecipient(
	shop: string,
	channel: RecipientChannel
): Promise<boolean> {
	return (await getVerifiedDestinations(shop, channel)).length > 0;
}

/**
 * Adds a recipient (or re-sends a link to an existing unconfirmed one) and
 * dispatches a fresh confirmation link.
 */
export async function addRecipient(
	shop: string,
	channel: RecipientChannel,
	rawDestination: string
): Promise<RecipientView> {
	const destination = normalize(rawDestination);
	await ensureShopRow(shop);

	const [existing] = await db
		.select()
		.from(alertRecipients)
		.where(
			and(
				eq(alertRecipients.shop, shop),
				eq(alertRecipients.channel, channel),
				eq(alertRecipients.destination, destination)
			)
		)
		.limit(1);

	if (existing?.verified) {
		throw new RecipientError('That address is already confirmed', 409);
	}
	if (existing && !canResend(existing)) {
		throw new RecipientError('Please wait a moment before requesting another link', 429);
	}

	const token = generateToken();
	const now = new Date();
	const fields = {
		verificationCode: token,
		verificationSentAt: now,
		verificationExpiresAt: new Date(now.getTime() + LINK_TTL_MS),
		verificationAttempts: 0
	};

	// Send before persisting so a send failure doesn't leave a dangling token
	await sendVerificationLink(destination, token);

	if (existing) {
		const [updated] = await db
			.update(alertRecipients)
			.set(fields)
			.where(eq(alertRecipients.id, existing.id))
			.returning();
		return toView(updated);
	}

	const [created] = await db
		.insert(alertRecipients)
		.values({ shop, channel, destination, ...fields })
		.returning();
	return toView(created);
}

export async function resendVerification(shop: string, id: string): Promise<RecipientView> {
	const [row] = await db
		.select()
		.from(alertRecipients)
		.where(and(eq(alertRecipients.id, id), eq(alertRecipients.shop, shop)))
		.limit(1);
	if (!row) throw new RecipientError('Recipient not found', 404);
	if (row.verified) throw new RecipientError('That recipient is already confirmed', 409);
	if (!canResend(row)) {
		throw new RecipientError('Please wait a moment before requesting another link', 429);
	}
	return addRecipient(shop, row.channel, row.destination);
}

/**
 * Confirms a recipient from the token in its emailed link. Returns the confirmed
 * recipient, or null if the token is unknown/expired (or already used). Public:
 * the token is the only secret, so no shop/session context is needed.
 */
export async function verifyByToken(token: string): Promise<RecipientView | null> {
	if (!token) return null;

	const [row] = await db
		.select()
		.from(alertRecipients)
		.where(eq(alertRecipients.verificationCode, token))
		.limit(1);
	if (!row) return null;
	if (row.verified) return toView(row);

	if (!row.verificationExpiresAt || Date.now() > row.verificationExpiresAt.getTime()) {
		return null;
	}

	const [verified] = await db
		.update(alertRecipients)
		.set({
			verified: true,
			verificationCode: null,
			verificationSentAt: null,
			verificationExpiresAt: null,
			verificationAttempts: 0
		})
		.where(eq(alertRecipients.id, row.id))
		.returning();
	return toView(verified);
}

export async function removeRecipient(shop: string, id: string): Promise<void> {
	await db
		.delete(alertRecipients)
		.where(and(eq(alertRecipients.id, id), eq(alertRecipients.shop, shop)));
}
