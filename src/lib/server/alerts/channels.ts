/**
 * Channel adapters. Each returns a provider message ID (when available)
 * and throws on failure — the dispatcher records the outcome per channel.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { AlertContent } from './format';

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
	if (!sesClient) {
		sesClient = new SESv2Client({
			region: env.AWS_REGION || 'us-east-1',
			...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
				? {
						credentials: {
							accessKeyId: env.AWS_ACCESS_KEY_ID,
							secretAccessKey: env.AWS_SECRET_ACCESS_KEY
						}
					}
				: {})
		});
	}
	return sesClient;
}

/** True when AWS SES is configured to actually send. */
function sesConfigured(): boolean {
	return !!env.ALERT_FROM_EMAIL;
}

/**
 * Email is "configured" when SES can send for real, or — in dev only — always,
 * because dev falls back to logging the message to the console (see sendEmail).
 * This keeps the full alert funnel working locally without AWS credentials.
 */
export function isEmailConfigured(): boolean {
	return sesConfigured() || dev;
}

export async function sendEmail(
	recipients: string[],
	content: Pick<AlertContent, 'subject' | 'html' | 'text'>
): Promise<string | null> {
	if (!sesConfigured()) {
		if (dev) {
			console.log(
				`\n[dev] SES not configured — logging email instead of sending:\n` +
					`  To:      ${recipients.join(', ')}\n` +
					`  Subject: ${content.subject}\n` +
					`${content.text}\n`
			);
			return 'dev-console-email';
		}
		throw new Error('ALERT_FROM_EMAIL is not configured');
	}

	const result = await getSesClient().send(
		new SendEmailCommand({
			FromEmailAddress: env.ALERT_FROM_EMAIL,
			Destination: { ToAddresses: recipients },
			Content: {
				Simple: {
					Subject: { Data: content.subject },
					Body: {
						Html: { Data: content.html },
						Text: { Data: content.text }
					}
				}
			}
		})
	);
	return result.MessageId ?? null;
}

export async function sendSlack(
	webhookUrl: string,
	payload: Record<string, unknown>
): Promise<null> {
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
	}
	return null;
}
