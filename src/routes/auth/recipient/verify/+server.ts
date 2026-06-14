/**
 * Public email-confirmation landing page. The recipient clicks the link in their
 * email, which lands here with the token; we confirm the address and render a
 * standalone success/failure page (opened in a normal browser tab, no session).
 */
import type { RequestHandler } from './$types';
import { verifyByToken } from '$lib/server/recipients';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function page(title: string, message: string): string {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${escapeHtml(title)} · Cart Radar</title>
</head>
<body style="margin:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#202223;">
	<div style="max-width:480px;margin:64px auto;padding:0 24px;">
		<div style="background:#ffffff;border:1px solid #e3e3e3;border-radius:12px;padding:32px;text-align:center;">
			<p style="margin:0 0 8px;font-size:13px;color:#6d7175;text-transform:uppercase;letter-spacing:0.5px;">Cart Radar</p>
			<h1 style="margin:0 0 12px;font-size:22px;">${escapeHtml(title)}</h1>
			<p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.5;">${message}</p>
		</div>
	</div>
</body>
</html>`;
}

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const recipient = await verifyByToken(token);

	const body = recipient
		? page(
				'Email confirmed 🎉',
				`<strong>${escapeHtml(recipient.destination)}</strong> will now receive Cart Radar alerts. You can close this tab.`
			)
		: page(
				'Link no longer valid',
				'This confirmation link is invalid or has expired. If you already confirmed, you’re all set — otherwise resend the link from Cart Radar settings.'
			);

	return new Response(body, {
		status: recipient ? 200 : 400,
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
};
