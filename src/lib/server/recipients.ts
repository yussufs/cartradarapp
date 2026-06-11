/**
 * Alert recipient management: add an email/phone, send it a one-time
 * verification code, confirm the code, and look up verified destinations.
 *
 * Nothing is ever sent to an unverified destination — this proves the merchant
 * owns the address/number (deliverability for email, consent for SMS).
 */
import crypto from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { alertRecipients, type RecipientChannel } from '$lib/shared/db/schema';
import { ensureShopRow } from '$lib/server/checkouts';
import {
	isEmailConfigured,
	isSmsConfigured,
	sendEmail,
	sendSms
} from '$lib/server/alerts/channels';

const CODE_TTL_MS = 15 * 60 * 1000; // codes expire after 15 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // at most one code every 30 seconds
const MAX_ATTEMPTS = 5; // wrong-code attempts before a resend is required

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export type RecipientRow = typeof alertRecipients.$inferSelect;

/** Public shape — never leaks the verification code. */
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

function generateCode(): string {
	return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
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

function normalize(channel: RecipientChannel, raw: string): string {
	const value = raw.trim();
	if (channel === 'email') {
		const lowered = value.toLowerCase();
		if (!EMAIL_RE.test(lowered)) throw new RecipientError('Enter a valid email address');
		return lowered;
	}
	const phone = value.replace(/[\s()-]/g, '');
	if (!PHONE_RE.test(phone)) {
		throw new RecipientError('Enter a phone number in international format, e.g. +15551234567');
	}
	return phone;
}

async function sendVerificationCode(
	channel: RecipientChannel,
	destination: string,
	code: string
): Promise<void> {
	if (channel === 'email') {
		if (!isEmailConfigured()) {
			throw new RecipientError('Email sending is not configured on the server yet', 503);
		}
		await sendEmail([destination], {
			subject: `Your Cart Radar verification code is ${code}`,
			text: `Your Cart Radar verification code is ${code}. It expires in 15 minutes.`,
			html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;">
				<p style="font-size:14px;color:#6d7175;margin:0 0 8px;">Cart Radar verification</p>
				<p style="margin:0 0 16px;">Use this code to confirm <strong>${destination}</strong> for cart alerts:</p>
				<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0;">${code}</p>
				<p style="font-size:13px;color:#6d7175;margin:16px 0 0;">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
			</div>`
		});
		return;
	}

	if (!isSmsConfigured()) {
		throw new RecipientError('SMS sending is not configured on the server yet', 503);
	}
	await sendSms(destination, `Cart Radar verification code: ${code} (expires in 15 minutes)`);
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
 * Adds a recipient (or re-sends a code to an existing unverified one) and
 * dispatches a fresh verification code.
 */
export async function addRecipient(
	shop: string,
	channel: RecipientChannel,
	rawDestination: string
): Promise<RecipientView> {
	const destination = normalize(channel, rawDestination);
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
		throw new RecipientError('That address is already verified', 409);
	}
	if (existing && !canResend(existing)) {
		throw new RecipientError('Please wait a moment before requesting another code', 429);
	}

	const code = generateCode();
	const now = new Date();
	const fields = {
		verificationCode: code,
		verificationSentAt: now,
		verificationExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
		verificationAttempts: 0
	};

	// Send before persisting so a send failure doesn't leave a dangling code
	await sendVerificationCode(channel, destination, code);

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

export async function resendCode(shop: string, id: string): Promise<RecipientView> {
	const [row] = await db
		.select()
		.from(alertRecipients)
		.where(and(eq(alertRecipients.id, id), eq(alertRecipients.shop, shop)))
		.limit(1);
	if (!row) throw new RecipientError('Recipient not found', 404);
	if (row.verified) throw new RecipientError('That recipient is already verified', 409);
	if (!canResend(row)) {
		throw new RecipientError('Please wait a moment before requesting another code', 429);
	}
	return addRecipient(shop, row.channel, row.destination);
}

export async function verifyRecipient(
	shop: string,
	id: string,
	code: string
): Promise<RecipientView> {
	const [row] = await db
		.select()
		.from(alertRecipients)
		.where(and(eq(alertRecipients.id, id), eq(alertRecipients.shop, shop)))
		.limit(1);
	if (!row) throw new RecipientError('Recipient not found', 404);
	if (row.verified) return toView(row);

	if (!row.verificationCode || !row.verificationExpiresAt) {
		throw new RecipientError('Request a new verification code', 410);
	}
	if (Date.now() > row.verificationExpiresAt.getTime()) {
		throw new RecipientError('That code has expired — request a new one', 410);
	}
	if (row.verificationAttempts >= MAX_ATTEMPTS) {
		throw new RecipientError('Too many attempts — request a new code', 429);
	}

	const submitted = code.trim();
	// Constant-time compare to avoid leaking the code via timing
	const matches =
		submitted.length === row.verificationCode.length &&
		crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(row.verificationCode));

	if (!matches) {
		await db
			.update(alertRecipients)
			.set({ verificationAttempts: row.verificationAttempts + 1 })
			.where(eq(alertRecipients.id, row.id));
		throw new RecipientError('That code is incorrect', 422);
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
