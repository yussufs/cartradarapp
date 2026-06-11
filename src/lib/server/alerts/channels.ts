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

export function isSmsConfigured(): boolean {
	return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
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

export async function sendSms(to: string, body: string): Promise<string | null> {
	const sid = env.TWILIO_ACCOUNT_SID;
	const authToken = env.TWILIO_AUTH_TOKEN;
	const from = env.TWILIO_FROM_NUMBER;
	if (!sid || !authToken || !from) throw new Error('Twilio is not configured');

	const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
		method: 'POST',
		headers: {
			Authorization: 'Basic ' + Buffer.from(`${sid}:${authToken}`).toString('base64'),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ To: to, From: from, Body: body })
	});

	const data = (await response.json()) as { sid?: string; message?: string };
	if (!response.ok) {
		throw new Error(`Twilio error: ${data.message ?? response.status}`);
	}
	return data.sid ?? null;
}
