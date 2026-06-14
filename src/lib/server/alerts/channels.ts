/**
 * Channel adapters. Each returns a provider message ID (when available)
 * and throws on failure — the dispatcher records the outcome per channel.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
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

export function isEmailConfigured(): boolean {
	return !!env.ALERT_FROM_EMAIL;
}

export async function sendEmail(
	recipients: string[],
	content: Pick<AlertContent, 'subject' | 'html' | 'text'>
): Promise<string | null> {
	if (!isEmailConfigured()) throw new Error('ALERT_FROM_EMAIL is not configured');

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
