<script lang="ts">
	import { onMount } from 'svelte';
	import { Page, Card, Button, Banner, Badge, Skeleton } from '$lib/components';

	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let working = $state(false);

	let plan = $state<'free' | 'pro'>('free');
	let subscriptionActive = $state(false);
	let proUntil = $state<string | null>(null);
	// Pro purely via the post-cancel grace window (no active paying subscription).
	const inGrace = $derived(plan === 'pro' && !subscriptionActive);
	let pricing = $state({ proPriceUsd: 29, freeAlertsPerMonth: 5 });
	let alerts = $state<{ used: number; limit: number | null; limitReached: boolean }>({
		used: 0,
		limit: 5,
		limitReached: false
	});
	let recovery = $state({ recoveries: 0, recoveredRevenue: '0' });
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
			plan = data.plan;
			subscriptionActive = data.subscriptionActive;
			proUntil = data.proUntil;
			pricing = data.pricing;
			alerts = data.alerts;
			recovery = data.recovery;
			currency = data.currency;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load billing';
		} finally {
			isLoading = false;
		}
	}

	onMount(load);

	async function upgrade() {
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
				actionError = data.error ?? 'Could not start the upgrade. Please try again.';
				return;
			}
			// Merchant approves the $29/mo subscription on Shopify's confirmation page
			window.open(data.confirmationUrl, '_top');
		} catch {
			actionError = 'Could not start the upgrade. Please try again.';
		} finally {
			working = false;
		}
	}

	async function downgrade() {
		working = true;
		actionError = '';
		try {
			const response = await authFetch('/api/billing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'cancel' })
			});
			const data = await response.json();
			if (!response.ok) {
				actionError = data.error ?? 'Could not cancel. Please try again.';
				return;
			}
			window.shopify?.toast?.show(
				data.proUntil
					? `Pro stays active until ${when(data.proUntil)}, then you move to Free`
					: 'Moved to Free'
			);
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

<Page title="Plan & billing" subtitle="One simple plan — upgrade for unlimited alerts.">
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

			{#if plan === 'free' && alerts.limitReached}
				<Banner tone="warning" title="You've hit your monthly alert limit">
					<p>
						You've used all {alerts.limit} alerts this month, so new alerts are paused until next month.
						Upgrade to Pro for unlimited alerts.
					</p>
				</Banner>
			{/if}

			{#if inGrace}
				<Banner tone="info" title="Your Pro plan is cancelled">
					<p>
						You'll keep unlimited alerts until <strong
							>{proUntil ? when(proUntil) : 'the end of your billing period'}</strong
						>, then move to Free. Resubscribe any time to stay on Pro.
					</p>
				</Banner>
			{/if}

			<Card title="Your plan">
				{#snippet actions()}
					{#if plan === 'pro'}
						<Badge tone="success">Pro</Badge>
					{:else}
						<Badge tone="info">Free</Badge>
					{/if}
				{/snippet}
				<div class="plan-grid">
					<div class="plan-col" class:current={plan === 'free'}>
						<p class="plan-name">Free</p>
						<p class="plan-price">{money(0)}<span class="per">/mo</span></p>
						<ul class="plan-points">
							<li>Up to {pricing.freeAlertsPerMonth} alerts per month</li>
							<li>Email &amp; Slack alerts</li>
							<li>Recovery tracking &amp; analytics</li>
						</ul>
						{#if plan === 'free'}
							<Badge tone="info">Current plan</Badge>
						{:else if subscriptionActive}
							<Button loading={working} onclick={downgrade}>Downgrade to Free</Button>
						{:else}
							<span class="muted">Starts {proUntil ? when(proUntil) : 'soon'}</span>
						{/if}
					</div>
					<div class="plan-col" class:current={plan === 'pro'}>
						<p class="plan-name">Pro</p>
						<p class="plan-price">
							{money(pricing.proPriceUsd, 'USD')}<span class="per">/mo</span>
						</p>
						<ul class="plan-points">
							<li><strong>Unlimited</strong> alerts</li>
							<li>Email &amp; Slack alerts</li>
							<li>Recovery tracking &amp; analytics</li>
						</ul>
						{#if plan === 'pro' && subscriptionActive}
							<Badge tone="success">Current plan</Badge>
						{:else if inGrace}
							<Button variant="primary" loading={working} onclick={upgrade}>Resubscribe</Button>
						{:else}
							<Button variant="primary" loading={working} onclick={upgrade}>
								Upgrade to Pro — {money(pricing.proPriceUsd, 'USD')}/mo
							</Button>
						{/if}
					</div>
				</div>
			</Card>

			<Card title="This month">
				<div class="usage-row">
					<div>
						<p class="usage-label">Alerts used</p>
						<p class="usage-value">
							{alerts.used}{#if alerts.limit !== null}<span class="usage-sub">
									/ {alerts.limit}</span
								>{:else}<span class="usage-sub"> · Unlimited</span>{/if}
						</p>
					</div>
				</div>
			</Card>

			<Card title="Last 30 days">
				<div class="usage-row">
					<div>
						<p class="usage-label">Carts recovered</p>
						<p class="usage-value">{recovery.recoveries}</p>
					</div>
					<div>
						<p class="usage-label">Revenue recovered</p>
						<p class="usage-value">{money(recovery.recoveredRevenue)}</p>
					</div>
				</div>
			</Card>
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

	.plan-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}

	.plan-col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
		padding: 16px;
		border: 1px solid var(--p-color-border, #e3e3e3);
		border-radius: 12px;
	}

	.plan-col.current {
		border-color: var(--p-color-border-emphasis, #1a1a1a);
		background: var(--p-color-bg-surface-secondary, #f6f6f7);
	}

	.plan-name {
		margin: 0;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.plan-price {
		margin: 0;
		font-size: 28px;
		font-weight: 650;
	}

	.per {
		font-size: 15px;
		font-weight: 400;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.muted {
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.plan-points {
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

	.usage-sub {
		font-size: 15px;
		font-weight: 400;
		color: var(--p-color-text-secondary, #6d7175);
	}
</style>
