<script lang="ts">
	import { onMount } from 'svelte';
	import { Page, Card, Button, Banner, Badge, DataTable, Skeleton } from '$lib/components';

	interface RecentFee {
		id: string;
		orderId: string | null;
		recoveredAmount: string | null;
		amount: string;
		billed: boolean;
		createdAt: string;
	}

	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let working = $state(false);

	let billingActive = $state(false);
	let pricing = $state({ feePercent: 1, minFeeUsd: 1, cappedAmountUsd: 500 });
	let usage = $state({ recoveries: 0, feesUsd: '0', recoveredRevenue: '0' });
	let recent = $state<RecentFee[]>([]);
	let currency = $state('USD');

	async function authFetch(path: string, init?: RequestInit): Promise<Response> {
		const token = await window.shopify.idToken();
		return fetch(path, {
			...init,
			headers: { ...init?.headers, Authorization: `Bearer ${token}` }
		});
	}

	async function load() {
		try {
			const response = await authFetch('/api/billing');
			if (!response.ok) throw new Error(`Failed to load billing (${response.status})`);
			const data = await response.json();
			billingActive = data.billingActive;
			pricing = data.pricing;
			usage = data.usage;
			recent = data.recent;
			currency = data.currency;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load billing';
		} finally {
			isLoading = false;
		}
	}

	onMount(load);

	async function activate() {
		working = true;
		actionError = '';
		try {
			const response = await authFetch('/api/billing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'activate' })
			});
			const data = await response.json();
			if (!response.ok) {
				actionError = data.error ?? 'Could not start activation. Please try again.';
				return;
			}
			// Merchant approves the usage subscription on Shopify's confirmation page
			window.open(data.confirmationUrl, '_top');
		} catch {
			actionError = 'Could not start activation. Please try again.';
		} finally {
			working = false;
		}
	}

	async function cancel() {
		working = true;
		actionError = '';
		try {
			const response = await authFetch('/api/billing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'cancel' })
			});
			if (!response.ok) {
				const data = await response.json();
				actionError = data.error ?? 'Could not cancel. Please try again.';
				return;
			}
			window.shopify?.toast?.show('Billing cancelled');
			await load();
		} catch {
			actionError = 'Could not cancel. Please try again.';
		} finally {
			working = false;
		}
	}

	function money(amount: string | number, c = currency): string {
		const value = typeof amount === 'string' ? parseFloat(amount) : amount;
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(value);
		} catch {
			return `${c} ${value.toFixed(2)}`;
		}
	}

	function usd(amount: string | number): string {
		const value = typeof amount === 'string' ? parseFloat(amount) : amount;
		return `$${value.toFixed(2)}`;
	}

	function when(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Plan & billing · Cart Radar</title>
</svelte:head>

<Page
	title="Plan & billing"
	subtitle="Cart Radar only earns when it recovers a sale for you — no monthly fee."
>
	{#if isLoading}
		<Card>
			<div class="skeleton-stack">
				<Skeleton variant="text" width="30%" />
				<Skeleton variant="box" height="160px" />
			</div>
		</Card>
	{:else if loadError}
		<Banner tone="critical" title="Couldn't load billing">
			<p>{loadError}</p>
		</Banner>
	{:else}
		<div class="billing-stack">
			{#if actionError}
				<Banner tone="critical" dismissible ondismiss={() => (actionError = '')}>
					<p>{actionError}</p>
				</Banner>
			{/if}

			<Card title="How pricing works">
				{#snippet actions()}
					{#if billingActive}
						<Badge tone="success">Active</Badge>
					{:else}
						<Badge tone="caution">Not active</Badge>
					{/if}
				{/snippet}
				<div class="pricing-body">
					<p class="headline">
						{pricing.feePercent}% of every cart we recover
						<span class="headline-sub">· {usd(pricing.minFeeUsd)} minimum per recovery</span>
					</p>
					<ul class="pricing-points">
						<li>
							No monthly fee — you pay only when a high-value cart is recovered after an alert.
						</li>
						<li>Unlimited email, Slack, and SMS alerts.</li>
						<li>
							Only <strong>exact</strong> recoveries (the order came from the cart we alerted on) are
							billed.
						</li>
						<li>
							Capped at {usd(pricing.cappedAmountUsd)}/month by default — you approve any change.
						</li>
					</ul>
					{#if billingActive}
						<Button loading={working} onclick={cancel}>Cancel billing</Button>
					{:else}
						<Button variant="primary" loading={working} onclick={activate}>Activate billing</Button>
					{/if}
				</div>
			</Card>

			{#if !billingActive}
				<Banner tone="info">
					<p>
						Billing isn't active yet, so we can't bill recoveries. Activating is free — you're only
						charged when Cart Radar actually recovers a cart.
					</p>
				</Banner>
			{/if}

			<Card title="Last 30 days">
				<div class="usage-row">
					<div>
						<p class="usage-label">Carts recovered</p>
						<p class="usage-value">{usage.recoveries}</p>
					</div>
					<div>
						<p class="usage-label">Revenue recovered</p>
						<p class="usage-value">{money(usage.recoveredRevenue)}</p>
					</div>
					<div>
						<p class="usage-label">Fees</p>
						<p class="usage-value">{usd(usage.feesUsd)}</p>
					</div>
				</div>
			</Card>

			{#if recent.length > 0}
				<Card title="Recent recovery fees" padding="none">
					<DataTable>
						<thead>
							<tr>
								<th>Date</th>
								<th>Order</th>
								<th>Recovered</th>
								<th>Fee</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each recent as fee (fee.id)}
								<tr>
									<td>{when(fee.createdAt)}</td>
									<td>{fee.orderId ?? '—'}</td>
									<td>{fee.recoveredAmount ? money(fee.recoveredAmount) : '—'}</td>
									<td>{usd(fee.amount)}</td>
									<td>
										{#if fee.billed}
											<Badge tone="success">Billed</Badge>
										{:else}
											<Badge tone="caution">Pending</Badge>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</DataTable>
				</Card>
			{/if}
		</div>
	{/if}
</Page>

<style>
	.billing-stack,
	.skeleton-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.pricing-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}

	.headline {
		margin: 0;
		font-size: 22px;
		font-weight: 650;
	}

	.headline-sub {
		font-size: 15px;
		font-weight: 400;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.pricing-points {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
	}

	.usage-row {
		display: flex;
		gap: 48px;
		flex-wrap: wrap;
	}

	.usage-label {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.usage-value {
		margin: 0;
		font-size: 24px;
		font-weight: 650;
	}
</style>
