<script lang="ts">
	import { onMount } from 'svelte';
	import { Page, Card, Button, Banner, Badge, Skeleton } from '$lib/components';

	interface PlanInfo {
		plan: 'free' | 'pro' | 'scale';
		monthlyPriceUsd: number;
		alertLimit: number | null;
		includedSms: number;
		smsPricing: { domestic: number; international: number } | null;
		defaultCappedAmountUsd: number;
	}

	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let changingTo = $state<string | null>(null);
	let current = $state<{ plan: string; alertsUsed: number; smsUsed: number }>({
		plan: 'free',
		alertsUsed: 0,
		smsUsed: 0
	});
	let plans = $state<PlanInfo[]>([]);

	const planCopy: Record<string, { name: string; tagline: string; features: string[] }> = {
		free: {
			name: 'Free',
			tagline: 'Try it out',
			features: ['10 alerts per 30 days', 'Email alerts', 'Slack alerts', '1 alert rule']
		},
		pro: {
			name: 'Pro',
			tagline: 'For stores that can’t miss a big cart',
			features: [
				'Unlimited email + Slack alerts',
				'50 SMS alerts/mo included (US & Canada)',
				'Then 5¢ US/Canada · 15¢ international per SMS',
				'You set the monthly SMS spend cap',
				'Recovery analytics'
			]
		},
		scale: {
			name: 'Scale',
			tagline: 'For high-volume and B2B stores',
			features: [
				'Everything in Pro',
				'300 SMS alerts/mo included (US & Canada)',
				'Then 4¢ US/Canada · 12¢ international per SMS',
				'Multiple alert rules (coming soon)'
			]
		}
	};

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
			current = data.current;
			plans = data.plans;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load billing';
		} finally {
			isLoading = false;
		}
	}

	onMount(load);

	async function changePlan(plan: string) {
		changingTo = plan;
		actionError = '';
		try {
			const response = await authFetch('/api/billing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan })
			});
			const data = await response.json();
			if (!response.ok) {
				actionError = data.error ?? 'Plan change failed. Please try again.';
				return;
			}
			if (data.confirmationUrl) {
				// Merchant approves the charge on Shopify's confirmation page
				window.open(data.confirmationUrl, '_top');
				return;
			}
			// Downgrade to free — no confirmation needed
			window.shopify?.toast?.show('Subscription cancelled');
			await load();
		} catch {
			actionError = 'Plan change failed. Please try again.';
		} finally {
			changingTo = null;
		}
	}

	function priceLabel(plan: PlanInfo): string {
		return plan.monthlyPriceUsd === 0 ? 'Free' : `$${plan.monthlyPriceUsd}/month`;
	}
</script>

<svelte:head>
	<title>Plan & billing · Cart Radar</title>
</svelte:head>

<Page
	title="Plan & billing"
	subtitle="One recovered high-value cart usually pays for years of Cart Radar."
>
	{#if isLoading}
		<Card>
			<div class="skeleton-stack">
				<Skeleton variant="text" width="30%" />
				<Skeleton variant="box" height="180px" />
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

			<Card title="Current usage">
				<div class="usage-row">
					<div>
						<p class="usage-label">Alerts this period</p>
						<p class="usage-value">{current.alertsUsed}</p>
					</div>
					<div>
						<p class="usage-label">SMS this period</p>
						<p class="usage-value">{current.smsUsed}</p>
					</div>
				</div>
			</Card>

			<div class="plan-grid">
				{#each plans as plan (plan.plan)}
					<Card title={planCopy[plan.plan].name}>
						{#snippet actions()}
							{#if current.plan === plan.plan}
								<Badge tone="success">Current plan</Badge>
							{/if}
						{/snippet}
						<div class="plan-body">
							<p class="plan-price">{priceLabel(plan)}</p>
							<p class="plan-tagline">{planCopy[plan.plan].tagline}</p>
							<ul class="plan-features">
								{#each planCopy[plan.plan].features as feature (feature)}
									<li>{feature}</li>
								{/each}
							</ul>
							{#if current.plan !== plan.plan}
								<Button
									variant={plan.plan === 'free' ? 'secondary' : 'primary'}
									loading={changingTo === plan.plan}
									onclick={() => changePlan(plan.plan)}
								>
									{plan.plan === 'free'
										? 'Downgrade to Free'
										: `Switch to ${planCopy[plan.plan].name}`}
								</Button>
							{/if}
						</div>
					</Card>
				{/each}
			</div>

			<p class="fine-print">
				Paid plans bill through your Shopify invoice. SMS beyond the included volume is charged as
				Shopify usage charges, capped at ${plans.find((p) => p.plan === current.plan)
					?.defaultCappedAmountUsd ?? 25}/month by default — you approve any cap change.
			</p>
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

	.usage-row {
		display: flex;
		gap: 48px;
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

	.plan-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
		align-items: start;
	}

	.plan-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}

	.plan-price {
		margin: 0;
		font-size: 22px;
		font-weight: 650;
	}

	.plan-tagline {
		margin: 0;
		color: var(--p-color-text-secondary, #6d7175);
		font-size: 13px;
	}

	.plan-features {
		margin: 0 0 8px;
		padding-left: 18px;
		font-size: 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.fine-print {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}
</style>
