<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Page, Card, Button, Banner, Badge, DataTable, Skeleton, Divider } from '$lib/components';

	interface LineItem {
		title: string;
		quantity: number;
		price: string;
		variantTitle: string | null;
		sku: string | null;
	}

	interface CheckoutDetail {
		id: string;
		abandonedCheckoutUrl: string | null;
		totalPrice: string;
		currency: string;
		itemCount: number;
		customerName: string | null;
		customerEmail: string | null;
		customerPhone: string | null;
		lineItems: LineItem[];
		status: 'active' | 'abandoned' | 'alerted' | 'recovered' | 'completed';
		checkoutCreatedAt: string | null;
		lastActivityAt: string;
		alertedAt: string | null;
		recoveredAt: string | null;
		recoveredAmount: string | null;
		recoveryMatch: 'token' | 'email' | 'phone' | null;
	}

	interface AlertEntry {
		id: string;
		channel: 'email' | 'slack' | 'sms';
		recipient: string | null;
		status: 'queued' | 'sent' | 'failed';
		error: string | null;
		sentAt: string | null;
		createdAt: string;
	}

	let isLoading = $state(true);
	let loadError = $state('');
	let checkout = $state<CheckoutDetail | null>(null);
	let alerts = $state<AlertEntry[]>([]);
	let copied = $state(false);

	onMount(async () => {
		try {
			const token = await window.shopify.idToken();
			const response = await fetch(`/api/checkouts/${page.params.id}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (response.status === 404) throw new Error('This checkout could not be found.');
			if (!response.ok) throw new Error(`Failed to load checkout (${response.status})`);
			const data = await response.json();
			checkout = data.checkout;
			alerts = data.alerts;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load checkout';
		} finally {
			isLoading = false;
		}
	});

	function money(amount: string | number, currency = 'USD'): string {
		const value = typeof amount === 'string' ? parseFloat(amount) : amount;
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
		} catch {
			return `${currency} ${value.toFixed(2)}`;
		}
	}

	function when(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	async function copyRecoveryLink() {
		if (!checkout?.abandonedCheckoutUrl) return;
		await navigator.clipboard.writeText(checkout.abandonedCheckoutUrl);
		copied = true;
		window.shopify?.toast?.show('Recovery link copied');
		setTimeout(() => (copied = false), 2000);
	}

	const statusBadge: Record<
		CheckoutDetail['status'],
		{ tone: 'default' | 'caution' | 'info' | 'success'; label: string }
	> = {
		active: { tone: 'default', label: 'Active' },
		abandoned: { tone: 'caution', label: 'Missed' },
		alerted: { tone: 'info', label: 'Alerted' },
		recovered: { tone: 'success', label: 'Recovered' },
		completed: { tone: 'default', label: 'Completed' }
	};
</script>

<svelte:head>
	<title>Abandoned cart · Cart Radar</title>
</svelte:head>

<Page
	title={checkout ? money(checkout.totalPrice, checkout.currency) + ' cart' : 'Abandoned cart'}
	backAction={{ url: '/app', label: 'Dashboard' }}
>
	{#if isLoading}
		<Card>
			<div class="skeleton-stack">
				<Skeleton variant="text" width="30%" />
				<Skeleton variant="box" height="120px" />
			</div>
		</Card>
	{:else if loadError || !checkout}
		<Banner tone="critical" title="Couldn't load checkout">
			<p>{loadError || 'Unknown error'}</p>
		</Banner>
	{:else}
		<div class="detail-stack">
			{#if checkout.status === 'recovered'}
				<Banner tone="success" title="This cart was recovered">
					<p>
						An order for {money(checkout.recoveredAmount ?? checkout.totalPrice, checkout.currency)}
						was placed on {when(checkout.recoveredAt)} after the alert went out.
						{#if checkout.recoveryMatch === 'token'}
							Matched exactly to this checkout.
						{:else if checkout.recoveryMatch === 'email' || checkout.recoveryMatch === 'phone'}
							Inferred from the customer's {checkout.recoveryMatch} on a later checkout.
						{/if}
					</p>
				</Banner>
			{/if}

			<Card title="Customer">
				{#snippet actions()}
					<Badge tone={statusBadge[checkout!.status].tone}
						>{statusBadge[checkout!.status].label}</Badge
					>
				{/snippet}
				<div class="info-grid">
					<div>
						<p class="info-label">Name</p>
						<p class="info-value">{checkout.customerName ?? 'Unknown'}</p>
					</div>
					<div>
						<p class="info-label">Email</p>
						<p class="info-value">
							{#if checkout.customerEmail}
								<a href="mailto:{checkout.customerEmail}">{checkout.customerEmail}</a>
							{:else}
								—
							{/if}
						</p>
					</div>
					<div>
						<p class="info-label">Phone</p>
						<p class="info-value">
							{#if checkout.customerPhone}
								<a href="tel:{checkout.customerPhone}">{checkout.customerPhone}</a>
							{:else}
								—
							{/if}
						</p>
					</div>
					<div>
						<p class="info-label">Last activity</p>
						<p class="info-value">{when(checkout.lastActivityAt)}</p>
					</div>
				</div>
				{#if checkout.abandonedCheckoutUrl}
					<Divider />
					<div class="recovery-row">
						<p class="info-label">Customer's checkout recovery link</p>
						<Button onclick={copyRecoveryLink}>{copied ? 'Copied' : 'Copy link'}</Button>
					</div>
				{/if}
			</Card>

			<Card title="Cart contents ({checkout.itemCount} items)" padding="none">
				<DataTable>
					<thead>
						<tr>
							<th>Item</th>
							<th>Qty</th>
							<th>Price</th>
						</tr>
					</thead>
					<tbody>
						{#each checkout.lineItems as item, i (i)}
							<tr>
								<td>
									{item.title}
									{#if item.variantTitle}
										<span class="subdued">· {item.variantTitle}</span>
									{/if}
								</td>
								<td>{item.quantity}</td>
								<td>{money(item.price, checkout.currency)}</td>
							</tr>
						{/each}
						<tr>
							<td class="total-cell">Total</td>
							<td></td>
							<td class="total-cell">{money(checkout.totalPrice, checkout.currency)}</td>
						</tr>
					</tbody>
				</DataTable>
			</Card>

			<Card title="Alert history" padding={alerts.length === 0 ? 'base' : 'none'}>
				{#if alerts.length === 0}
					<p class="subdued">No alerts have been sent for this cart.</p>
				{:else}
					<DataTable>
						<thead>
							<tr>
								<th>Channel</th>
								<th>Recipient</th>
								<th>Status</th>
								<th>Sent</th>
							</tr>
						</thead>
						<tbody>
							{#each alerts as alert (alert.id)}
								<tr>
									<td class="channel-cell">{alert.channel}</td>
									<td>{alert.recipient ?? '—'}</td>
									<td>
										{#if alert.status === 'sent'}
											<Badge tone="success">Sent</Badge>
										{:else if alert.status === 'failed'}
											<Badge tone="critical">Failed</Badge>
										{:else}
											<Badge>Queued</Badge>
										{/if}
										{#if alert.error}
											<span class="subdued">{alert.error}</span>
										{/if}
									</td>
									<td>{when(alert.sentAt ?? alert.createdAt)}</td>
								</tr>
							{/each}
						</tbody>
					</DataTable>
				{/if}
			</Card>
		</div>
	{/if}
</Page>

<style>
	.detail-stack,
	.skeleton-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 16px;
	}

	.info-label {
		margin: 0 0 2px;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.info-value {
		margin: 0;
		font-weight: 500;
	}

	.recovery-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 12px;
	}

	.subdued {
		color: var(--p-color-text-secondary, #6d7175);
		font-size: 13px;
	}

	.total-cell {
		font-weight: 600;
	}

	.channel-cell {
		text-transform: capitalize;
	}
</style>
