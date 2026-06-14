<script lang="ts">
	import { Page, Card, Button, TextField, Banner, Badge } from '$lib/components';

	interface SeededCart {
		id: string;
		total: string;
		recovered: boolean;
	}

	let total = $state('750');
	let ageMinutes = $state('180');
	let working = $state('');
	let logLines = $state<string[]>([]);
	let seeded = $state<SeededCart[]>([]);

	function log(message: string) {
		const time = new Date().toLocaleTimeString();
		logLines = [`${time}  ${message}`, ...logLines].slice(0, 40);
	}

	async function authFetch(action: string, payload: Record<string, unknown> = {}): Promise<any> {
		const token = await window.shopify.idToken();
		const response = await fetch('/api/dev', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, ...payload })
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
		return data;
	}

	async function run(action: string, payload: Record<string, unknown>, label: string) {
		working = action;
		try {
			return await authFetch(action, payload);
		} catch (err) {
			log(`❌ ${label}: ${err instanceof Error ? err.message : 'failed'}`);
			return null;
		} finally {
			working = '';
		}
	}

	async function spawn() {
		const data = await run(
			'seed',
			{ total: Number(total), ageMinutes: Number(ageMinutes) },
			'Spawn cart'
		);
		if (!data) return;
		seeded = [{ id: data.id, total: data.total, recovered: false }, ...seeded];
		const source = data.usedRealProducts
			? 'real products'
			: 'synthetic item — grant read_products + re-auth for real ones';
		log(
			`🛒 Seeded $${data.total} cart · ${data.itemCount} item(s) · ${source} · alerted ✓ — reload the dashboard to see it · ${data.id.slice(0, 8)}`
		);
	}

	async function evaluate() {
		const data = await run('evaluate', {}, 'Run evaluator');
		if (data)
			log(`📣 Evaluator ran — ${data.alerted} cart(s) alerted (check server console for email)`);
	}

	async function recover(id: string) {
		const data = await run('recover', { checkoutId: id }, 'Recover');
		if (data?.ok) {
			seeded = seeded.map((c) => (c.id === id ? { ...c, recovered: true } : c));
			log(`💰 Recovered ${id.slice(0, 8)}`);
		} else {
			log(`⚠️ Could not recover ${id.slice(0, 8)} (already terminal?)`);
		}
	}

	async function setPlan(plan: 'free' | 'pro') {
		const data = await run('set-plan', { plan }, 'Set plan');
		if (data) log(`🔁 Plan set to ${data.plan}`);
	}

	async function reset() {
		const data = await run('reset', {}, 'Reset');
		if (data) {
			seeded = [];
			log(`🧹 Deleted ${data.deleted} seeded cart(s)`);
		}
	}
</script>

<svelte:head>
	<title>Dev tools · Cart Radar</title>
</svelte:head>

<Page title="Dev tools" subtitle="Simulate the abandoned-cart funnel without waiting.">
	<div class="dev-stack">
		<Banner tone="info">
			<p>
				Local testing only (DEV_TOOLS). Seed a cart, run the evaluator, then watch the alert in your <strong
					>server console</strong
				> (dev logs emails instead of sending). Recover a cart to test attribution and the recovered KPIs.
			</p>
		</Banner>

		<Card title="Spawn an abandoned cart">
			<div class="form-row">
				<TextField
					label="Cart total (USD)"
					name="total"
					type="number"
					value={total}
					min="1"
					oninput={(e) => (total = (e.target as HTMLInputElement).value)}
				/>
				<TextField
					label="Abandoned how long ago (minutes)"
					name="ageMinutes"
					type="number"
					value={ageMinutes}
					min="0"
					helpText="Backdates lastActivityAt so it qualifies immediately."
					oninput={(e) => (ageMinutes = (e.target as HTMLInputElement).value)}
				/>
			</div>
			<div class="button-row">
				<Button variant="primary" loading={working === 'seed'} onclick={spawn}>Spawn cart</Button>
				<Button loading={working === 'evaluate'} onclick={evaluate}>Run evaluator now</Button>
			</div>
		</Card>

		{#if seeded.length > 0}
			<Card title="Seeded carts this session">
				<ul class="seeded-list">
					{#each seeded as cart (cart.id)}
						<li>
							<span class="mono">{cart.id.slice(0, 8)}</span>
							<span>${cart.total}</span>
							{#if cart.recovered}
								<Badge tone="success">Recovered</Badge>
							{:else}
								<Button
									variant="plain"
									loading={working === 'recover'}
									onclick={() => recover(cart.id)}
								>
									Mark recovered
								</Button>
							{/if}
							<a href="/app/checkouts/{cart.id}">View</a>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}

		<Card title="Plan & cleanup">
			<div class="button-row">
				<Button loading={working === 'set-plan'} onclick={() => setPlan('free')}>Set Free</Button>
				<Button loading={working === 'set-plan'} onclick={() => setPlan('pro')}>Set Pro</Button>
				<Button tone="critical" loading={working === 'reset'} onclick={reset}>
					Delete seeded carts
				</Button>
			</div>
		</Card>

		{#if logLines.length > 0}
			<Card title="Activity">
				<pre class="log">{logLines.join('\n')}</pre>
			</Card>
		{/if}
	</div>
</Page>

<style>
	.dev-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-row {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.button-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.seeded-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.seeded-list li {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.log {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		line-height: 1.6;
		white-space: pre-wrap;
		color: var(--p-color-text-secondary, #4a4a4a);
	}
</style>
