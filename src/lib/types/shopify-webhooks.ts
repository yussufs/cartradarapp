/**
 * Webhook payload shapes for the topics Cart Radar subscribes to.
 * Webhook payloads use the REST resource format regardless of API client.
 * Only the fields we read are typed; everything else is passed through.
 */

export interface WebhookAddress {
	first_name?: string | null;
	last_name?: string | null;
	name?: string | null;
	phone?: string | null;
	country_code?: string | null;
}

export interface WebhookLineItem {
	title?: string | null;
	quantity?: number | null;
	price?: string | null;
	line_price?: string | null;
	variant_id?: number | null;
	variant_title?: string | null;
	sku?: string | null;
}

export interface CheckoutWebhookPayload {
	id: number;
	token: string;
	cart_token?: string | null;
	email?: string | null;
	phone?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	completed_at?: string | null;
	total_price?: string | null;
	currency?: string | null;
	presentment_currency?: string | null;
	abandoned_checkout_url?: string | null;
	line_items?: WebhookLineItem[] | null;
	customer?: {
		id?: number | null;
		email?: string | null;
		first_name?: string | null;
		last_name?: string | null;
		phone?: string | null;
	} | null;
	billing_address?: WebhookAddress | null;
	shipping_address?: WebhookAddress | null;
}

export interface OrderWebhookPayload {
	id: number;
	name?: string | null;
	checkout_token?: string | null;
	cart_token?: string | null;
	total_price?: string | null;
	currency?: string | null;
	created_at?: string | null;
	email?: string | null;
	phone?: string | null;
	contact_email?: string | null;
	// "shopify_draft_order" when the order came from a completed draft order
	source_name?: string | null;
	source_identifier?: string | null;
	customer?: {
		id?: number | null;
		email?: string | null;
		phone?: string | null;
	} | null;
}

/** draft_orders/update payload (REST draft order resource). */
export interface DraftOrderWebhookPayload {
	id: number;
	admin_graphql_api_id: string;
	name?: string | null;
	status?: 'open' | 'invoice_sent' | 'completed' | null;
	// Populated once the draft order completes into a real order
	order_id?: number | null;
	completed_at?: string | null;
	total_price?: string | null;
	currency?: string | null;
}

export interface AppSubscriptionWebhookPayload {
	app_subscription: {
		admin_graphql_api_id: string;
		name: string;
		status: 'ACTIVE' | 'CANCELLED' | 'DECLINED' | 'EXPIRED' | 'FROZEN' | 'PENDING' | 'ACCEPTED';
		admin_graphql_api_shop_id?: string;
		created_at?: string;
		updated_at?: string;
		currency?: string;
		capped_amount?: string;
	};
}

export interface ShopUpdateWebhookPayload {
	id: number;
	name?: string | null;
	currency?: string | null;
	email?: string | null;
	domain?: string | null;
	myshopify_domain?: string | null;
}
