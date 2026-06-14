/**
 * Builds the merchant-facing alert content (email HTML, Slack blocks) from a
 * tracked checkout snapshot.
 */
import { env } from '$env/dynamic/private';
import type { checkouts } from '$lib/shared/db/schema';

export type CheckoutRow = typeof checkouts.$inferSelect;

export interface AlertContent {
	subject: string;
	html: string;
	text: string;
	slackPayload: Record<string, unknown>;
}

export function formatMoney(amount: string | number, currency: string): string {
	const value = typeof amount === 'string' ? parseFloat(amount) : amount;
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
	} catch {
		return `${currency} ${value.toFixed(2)}`;
	}
}

/** Deep link into the embedded app inside Shopify Admin */
export function adminAppUrl(shop: string, path = ''): string {
	const storeHandle = shop.replace('.myshopify.com', '');
	return `https://admin.shopify.com/store/${storeHandle}/apps/${env.SHOPIFY_API_KEY}${path}`;
}

export function buildAlertContent(checkout: CheckoutRow): AlertContent {
	const total = formatMoney(checkout.totalPrice, checkout.currency);
	const customer = checkout.customerName || 'A customer';
	const dashboardUrl = adminAppUrl(checkout.shop, `/app/checkouts/${checkout.id}`);

	const subject = `🛒 ${total} cart abandoned — ${customer}`;

	const itemsText = checkout.lineItems
		.map(
			(item) =>
				`  • ${item.quantity}× ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ''} — ${formatMoney(item.price, checkout.currency)}`
		)
		.join('\n');

	const contactText = [
		checkout.customerEmail && `Email: ${checkout.customerEmail}`,
		checkout.customerPhone && `Phone: ${checkout.customerPhone}`
	]
		.filter(Boolean)
		.join('\n');

	const text = [
		`High-value cart abandoned on ${checkout.shop}`,
		``,
		`Customer: ${customer}`,
		contactText,
		``,
		`Cart total: ${total} (${checkout.itemCount} items)`,
		itemsText,
		``,
		checkout.abandonedCheckoutUrl
			? `Recovery link (for the customer): ${checkout.abandonedCheckoutUrl}`
			: null,
		`View in Cart Radar: ${dashboardUrl}`
	]
		.filter((line): line is string => line !== null)
		.join('\n');

	const itemsHtml = checkout.lineItems
		.map(
			(item) => `
			<tr>
				<td style="padding:8px 12px;border-bottom:1px solid #e3e3e3;">${escapeHtml(item.title)}${item.variantTitle ? `<br><span style="color:#6d7175;font-size:13px;">${escapeHtml(item.variantTitle)}</span>` : ''}</td>
				<td style="padding:8px 12px;border-bottom:1px solid #e3e3e3;text-align:center;">${item.quantity}</td>
				<td style="padding:8px 12px;border-bottom:1px solid #e3e3e3;text-align:right;">${formatMoney(item.price, checkout.currency)}</td>
			</tr>`
		)
		.join('');

	const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#202223;">
	<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e3e3e3;">
		<p style="margin:0 0 4px;font-size:13px;color:#6d7175;text-transform:uppercase;letter-spacing:0.5px;">Cart Radar · High-value cart alert</p>
		<h1 style="margin:0 0 16px;font-size:24px;">${total} cart abandoned</h1>
		<table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">
			<tr><td style="padding:4px 0;color:#6d7175;width:90px;">Customer</td><td style="padding:4px 0;">${escapeHtml(customer)}</td></tr>
			${checkout.customerEmail ? `<tr><td style="padding:4px 0;color:#6d7175;">Email</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(checkout.customerEmail)}">${escapeHtml(checkout.customerEmail)}</a></td></tr>` : ''}
			${checkout.customerPhone ? `<tr><td style="padding:4px 0;color:#6d7175;">Phone</td><td style="padding:4px 0;"><a href="tel:${escapeHtml(checkout.customerPhone)}">${escapeHtml(checkout.customerPhone)}</a></td></tr>` : ''}
			<tr><td style="padding:4px 0;color:#6d7175;">Store</td><td style="padding:4px 0;">${escapeHtml(checkout.shop)}</td></tr>
		</table>
		<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 8px;">
			<thead>
				<tr style="text-align:left;color:#6d7175;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">
					<th style="padding:8px 12px;border-bottom:2px solid #e3e3e3;">Item</th>
					<th style="padding:8px 12px;border-bottom:2px solid #e3e3e3;text-align:center;">Qty</th>
					<th style="padding:8px 12px;border-bottom:2px solid #e3e3e3;text-align:right;">Price</th>
				</tr>
			</thead>
			<tbody>${itemsHtml}</tbody>
			<tfoot>
				<tr>
					<td colspan="2" style="padding:12px;font-weight:600;">Total</td>
					<td style="padding:12px;text-align:right;font-weight:600;">${total}</td>
				</tr>
			</tfoot>
		</table>
		<div style="margin:24px 0 0;">
			<a href="${dashboardUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View in Cart Radar</a>
			${checkout.customerEmail ? `<a href="mailto:${escapeHtml(checkout.customerEmail)}" style="display:inline-block;margin-left:8px;color:#1a1a1a;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #c9cccf;">Email customer</a>` : ''}
		</div>
		${checkout.abandonedCheckoutUrl ? `<p style="margin:16px 0 0;font-size:13px;color:#6d7175;">Customer's recovery link: <a href="${checkout.abandonedCheckoutUrl}">${checkout.abandonedCheckoutUrl}</a></p>` : ''}
	</div>
</body>
</html>`;

	const slackPayload = {
		text: `${total} cart abandoned by ${customer} on ${checkout.shop}`,
		blocks: [
			{
				type: 'header',
				text: { type: 'plain_text', text: `🛒 ${total} cart abandoned`, emoji: true }
			},
			{
				type: 'section',
				fields: [
					{ type: 'mrkdwn', text: `*Customer:*\n${customer}` },
					{ type: 'mrkdwn', text: `*Cart total:*\n${total} (${checkout.itemCount} items)` },
					...(checkout.customerEmail
						? [{ type: 'mrkdwn', text: `*Email:*\n${checkout.customerEmail}` }]
						: []),
					...(checkout.customerPhone
						? [{ type: 'mrkdwn', text: `*Phone:*\n${checkout.customerPhone}` }]
						: [])
				]
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text:
						'*Items:*\n' +
						checkout.lineItems
							.map(
								(item) =>
									`• ${item.quantity}× ${item.title} — ${formatMoney(item.price, checkout.currency)}`
							)
							.join('\n')
				}
			},
			{
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: { type: 'plain_text', text: 'View in Cart Radar' },
						url: dashboardUrl,
						style: 'primary'
					}
				]
			}
		]
	};

	return { subject, html, text, slackPayload };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
