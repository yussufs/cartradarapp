<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Page,
		Card,
		Button,
		Banner,
		Badge,
		DataTable,
		EmptyState,
		Skeleton
	} from '$lib/components';

	interface RecentCheckout {
		id: string;
		customerName: string | null;
		customerEmail: string | null;
		totalPrice: string;
		currency: string;
		itemCount: number;
		status: 'abandoned' | 'alerted' | 'recovered';
		lastActivityAt: string;
		recoveredAmount: string | null;
	}

	let isLoading = $state(true);
	let loadError = $state('');
	let windowDays = $state(30);
	let kpis = $state({
		highValue: 0,
		missed: 0,
		recovered: 0,
		recoveredExact: 0,
		recoveredInferred: 0,
		recoveredAmount: '0',
		alertsSent: 0
	});
	let recent = $state<RecentCheckout[]>([]);
	let setup = $state({ ruleConfigured: false, channelConfigured: false, billingActive: false });

	onMount(async () => {
		try {
			const token = await window.shopify.idToken();
			const response = await fetch('/api/dashboard', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!response.ok) throw new Error(`Failed to load dashboard (${response.status})`);
			const data = await response.json();
			windowDays = data.windowDays;
			kpis = data.kpis;
			recent = data.recent;
			setup = data.setup;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load dashboard';
		} finally {
			isLoading = false;
		}
	});

	const needsSetup = $derived(!setup.ruleConfigured || !setup.channelConfigured);

	function money(amount: string | number, currency = 'USD'): string {
		const value = typeof amount === 'string' ? parseFloat(amount) : amount;
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
		} catch {
			return `${currency} ${value.toFixed(2)}`;
		}
	}

	function when(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	const statusBadge: Record<
		RecentCheckout['status'],
		{ tone: 'caution' | 'info' | 'success'; label: string }
	> = {
		abandoned: { tone: 'caution', label: 'Missed' },
		alerted: { tone: 'info', label: 'Alerted' },
		recovered: { tone: 'success', label: 'Recovered' }
	};
</script>

<svelte:head>
	<title>Dashboard · Cart Radar</title>
</svelte:head>

<Page title="Cart Radar" subtitle="High-value abandoned carts, last {windowDays} days.">
	{#if isLoading}
		<Card>
			<div class="skeleton-stack">
				<Skeleton variant="text" width="40%" />
				<Skeleton variant="box" height="80px" />
				<Skeleton variant="box" height="200px" />
			</div>
		</Card>
	{:else if loadError}
		<Banner tone="critical" title="Couldn't load dashboard">
			<p>{loadError}</p>
		</Banner>
	{:else}
		<div class="dashboard-stack">
			{#if needsSetup}
				<Banner tone="info" title="Finish setting up Cart Radar">
					{#snippet actions()}
						<Button variant="primary" href="/app/settings">Open settings</Button>
					{/snippet}
					<p>
						{#if !setup.ruleConfigured}
							Set your cart value threshold so Cart Radar knows which carts matter.
						{:else}
							Connect at least one alert channel (email, Slack, or SMS) so alerts can reach you.
						{/if}
					</p>
				</Banner>
			{/if}

			{#if !setup.billingActive}
				<Banner tone="warning" title="Activate billing to start recovering carts">
					{#snippet actions()}
						<Button variant="primary" href="/app/billing">Activate</Button>
					{/snippet}
					<p>
						Cart Radar is free until it recovers a cart — then it's 1% of that order ($1 min).
						Activate billing so we can alert you and track recoveries.
					</p>
				</Banner>
			{/if}

			<div class="kpi-grid">
				<Card>
					<p class="kpi-label">High-value abandons</p>
					<p class="kpi-value">{kpis.highValue}</p>
				</Card>
				<Card>
					<p class="kpi-label">Alerts sent</p>
					<p class="kpi-value">{kpis.alertsSent}</p>
				</Card>
				<Card>
					<p class="kpi-label">Carts recovered</p>
					<p class="kpi-value">{kpis.recovered}</p>
					{#if kpis.recovered > 0}
						<p class="kpi-caption">
							{kpis.recoveredExact} exact · {kpis.recoveredInferred} inferred
						</p>
					{/if}
				</Card>
				<Card>
					<p class="kpi-label">Revenue recovered</p>
					<p class="kpi-value kpi-success">{money(kpis.recoveredAmount)}</p>
				</Card>
			</div>

			<Card title="Recent high-value carts" padding="none">
				{#if recent.length === 0}
					<EmptyState
						heading="No high-value abandoned carts yet"
						description="When a cart over your threshold is abandoned, it shows up here and you get alerted."
					>
						<Button href="/app/settings">Review your threshold</Button>
					</EmptyState>
				{:else}
					<DataTable hoverable>
						<thead>
							<tr>
								<th>Customer</th>
								<th>Cart value</th>
								<th>Items</th>
								<th>Status</th>
								<th>Last activity</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each recent as checkout (checkout.id)}
								<tr>
									<td>
										{checkout.customerName ?? 'Unknown customer'}
										{#if checkout.customerEmail}
											<span class="subdued">· {checkout.customerEmail}</span>
										{/if}
									</td>
									<td class="value-cell">{money(checkout.totalPrice, checkout.currency)}</td>
									<td>{checkout.itemCount}</td>
									<td>
										<Badge tone={statusBadge[checkout.status].tone}>
											{statusBadge[checkout.status].label}
										</Badge>
									</td>
									<td>{when(checkout.lastActivityAt)}</td>
									<td><Button variant="plain" href="/app/checkouts/{checkout.id}">View</Button></td>
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
	.dashboard-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.skeleton-stack {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 16px;
	}

	.kpi-label {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.kpi-value {
		margin: 0;
		font-size: 24px;
		font-weight: 650;
	}

	.kpi-success {
		color: var(--p-color-text-success, #047b41);
	}

	.kpi-caption {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.subdued {
		color: var(--p-color-text-secondary, #6d7175);
		font-size: 13px;
	}

	.value-cell {
		font-weight: 600;
	}
</style>
