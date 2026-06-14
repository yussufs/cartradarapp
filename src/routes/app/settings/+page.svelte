<script lang="ts">
	import { onMount } from 'svelte';
	import { Page, Card, TextField, Select, Switch, Button, Banner, Skeleton } from '$lib/components';
	import RecipientManager from './RecipientManager.svelte';

	interface RecipientView {
		id: string;
		channel: 'email';
		destination: string;
		verified: boolean;
		canResend: boolean;
	}

	let isLoading = $state(true);
	let saving = $state(false);
	let testing = $state(false);
	let loadError = $state('');
	let saveErrors = $state<string[]>([]);
	let saveSuccess = $state(false);
	let testResult = $state<{ sent: number; failed: number; errors: string[] } | null>(null);

	// Alert rule
	let ruleEnabled = $state(true);
	let thresholdAmount = $state('500');
	let minItemCount = $state('');
	let inactivityMinutes = $state('60');

	// Recovery attribution
	let attributionWindowDays = $state('14');

	// Channels
	let emailEnabled = $state(true);
	let slackEnabled = $state(false);
	let slackWebhookUrl = $state('');

	// Recipients (managed independently of the form save)
	let recipients = $state<RecipientView[]>([]);
	const emailRecipients = $derived(recipients.filter((r) => r.channel === 'email'));

	let currency = $state('USD');

	const inactivityOptions = [
		{ label: '15 minutes', value: '15' },
		{ label: '30 minutes', value: '30' },
		{ label: '1 hour (recommended)', value: '60' },
		{ label: '2 hours', value: '120' },
		{ label: '4 hours', value: '240' }
	];

	const attributionOptions = [
		{ label: '7 days', value: '7' },
		{ label: '14 days (recommended)', value: '14' },
		{ label: '30 days', value: '30' },
		{ label: '60 days', value: '60' },
		{ label: '90 days', value: '90' }
	];

	async function authFetch(path: string, init?: RequestInit): Promise<Response> {
		const token = await window.shopify.idToken();
		return fetch(path, {
			...init,
			headers: { ...init?.headers, Authorization: `Bearer ${token}` }
		});
	}

	async function loadRecipients() {
		const response = await authFetch('/api/recipients');
		if (response.ok) recipients = (await response.json()).recipients;
	}

	onMount(async () => {
		try {
			const [settingsRes] = await Promise.all([authFetch('/api/settings'), loadRecipients()]);
			if (!settingsRes.ok) throw new Error(`Failed to load settings (${settingsRes.status})`);
			const data = await settingsRes.json();

			ruleEnabled = data.rule.enabled;
			thresholdAmount = String(data.rule.thresholdAmount);
			minItemCount = data.rule.minItemCount ? String(data.rule.minItemCount) : '';
			inactivityMinutes = String(data.rule.inactivityMinutes);
			attributionWindowDays = String(data.attributionWindowDays);

			emailEnabled = data.channels.emailEnabled;
			slackEnabled = data.channels.slackEnabled;
			slackWebhookUrl = data.channels.slackWebhookUrl ?? '';

			currency = data.currency;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load settings';
		} finally {
			isLoading = false;
		}
	});

	async function save(): Promise<boolean> {
		saving = true;
		saveErrors = [];
		saveSuccess = false;
		try {
			const response = await authFetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rule: {
						enabled: ruleEnabled,
						thresholdAmount: parseFloat(thresholdAmount),
						minItemCount: minItemCount ? parseInt(minItemCount, 10) : null,
						inactivityMinutes: parseInt(inactivityMinutes, 10)
					},
					attributionWindowDays: parseInt(attributionWindowDays, 10),
					channels: {
						emailEnabled,
						slackEnabled,
						slackWebhookUrl: slackWebhookUrl.trim() || null
					}
				})
			});
			if (response.status === 422) {
				saveErrors = (await response.json()).errors;
				return false;
			}
			if (!response.ok) {
				saveErrors = ['Something went wrong while saving. Please try again.'];
				return false;
			}
			saveSuccess = true;
			window.shopify?.toast?.show('Settings saved');
			return true;
		} catch {
			saveErrors = ['Something went wrong while saving. Please try again.'];
			return false;
		} finally {
			saving = false;
		}
	}

	async function sendTestAlert() {
		testing = true;
		testResult = null;
		try {
			// Test uses saved settings, so persist the form first
			const saved = await save();
			if (!saved) return;
			const response = await authFetch('/api/alerts/test', { method: 'POST' });
			testResult = await response.json();
		} catch {
			testResult = { sent: 0, failed: 0, errors: ['Test alert request failed'] };
		} finally {
			testing = false;
		}
	}
</script>

<svelte:head>
	<title>Settings · Cart Radar</title>
</svelte:head>

<Page title="Settings" subtitle="Decide which carts are worth an alert and where alerts go.">
	{#snippet primaryAction()}
		<Button variant="primary" loading={saving} onclick={() => save()}>Save</Button>
	{/snippet}
	{#snippet secondaryActions()}
		<Button loading={testing} onclick={sendTestAlert}>Send test alert</Button>
	{/snippet}

	{#if isLoading}
		<Card>
			<div class="skeleton-stack">
				<Skeleton variant="text" width="40%" />
				<Skeleton variant="box" height="120px" />
				<Skeleton variant="box" height="120px" />
			</div>
		</Card>
	{:else if loadError}
		<Banner tone="critical" title="Couldn't load settings">
			<p>{loadError}</p>
		</Banner>
	{:else}
		{#if saveErrors.length > 0}
			<Banner tone="critical" title="Couldn't save settings">
				<ul class="error-list">
					{#each saveErrors as error (error)}
						<li>{error}</li>
					{/each}
				</ul>
			</Banner>
		{/if}
		{#if saveSuccess && saveErrors.length === 0}
			<Banner tone="success" dismissible ondismiss={() => (saveSuccess = false)}>
				<p>Settings saved.</p>
			</Banner>
		{/if}
		{#if testResult}
			<Banner
				tone={testResult.failed > 0 || testResult.errors.length > 0 ? 'warning' : 'success'}
				title="Test alert result"
				dismissible
				ondismiss={() => (testResult = null)}
			>
				<p>
					{testResult.sent} sent, {testResult.failed} failed.
					{#if testResult.errors.length > 0}
						{testResult.errors.join(' · ')}
					{/if}
				</p>
			</Banner>
		{/if}

		<div class="settings-stack">
			<Card
				title="Alert rule"
				subtitle="An alert fires when a checkout goes quiet past the inactivity window and meets your threshold."
			>
				<div class="form-stack">
					<Switch
						label="High-value cart alerts"
						name="ruleEnabled"
						checked={ruleEnabled}
						helpText={ruleEnabled ? 'Alerts are on' : 'Alerts are paused'}
						onchange={(e) => (ruleEnabled = (e.target as HTMLInputElement).checked)}
					/>
					<TextField
						label="Cart value threshold ({currency})"
						name="thresholdAmount"
						type="number"
						value={thresholdAmount}
						min="1"
						step="1"
						helpText="Alert when an abandoned cart totals at least this amount."
						oninput={(e) => (thresholdAmount = (e.target as HTMLInputElement).value)}
					/>
					<TextField
						label="Minimum item count (optional)"
						name="minItemCount"
						type="number"
						value={minItemCount}
						min="1"
						step="1"
						helpText="Also alert when a cart has at least this many items, regardless of value. Leave empty to alert on value only."
						oninput={(e) => (minItemCount = (e.target as HTMLInputElement).value)}
					/>
					<Select
						label="Inactivity window"
						name="inactivityMinutes"
						options={inactivityOptions}
						value={inactivityMinutes}
						helpText="How long a checkout must sit untouched before it counts as abandoned."
						onchange={(e) => (inactivityMinutes = (e.target as HTMLSelectElement).value)}
					/>
				</div>
			</Card>

			<Card
				title="Recovery attribution"
				subtitle="When a customer comes back and buys later, how long do we still credit it to the alert?"
			>
				<div class="form-stack">
					<Select
						label="Attribution window"
						name="attributionWindowDays"
						options={attributionOptions}
						value={attributionWindowDays}
						helpText="Exact matches (same checkout) are always credited. This window only governs purchases made later from a new checkout by the same customer, shown separately as 'inferred' recoveries."
						onchange={(e) => (attributionWindowDays = (e.target as HTMLSelectElement).value)}
					/>
				</div>
			</Card>

			<Card
				title="Email alerts"
				subtitle="Each address gets a code to confirm before alerts start."
			>
				<div class="form-stack">
					<Switch
						label="Email"
						name="emailEnabled"
						checked={emailEnabled}
						onchange={(e) => (emailEnabled = (e.target as HTMLInputElement).checked)}
					/>
					<RecipientManager
						channel="email"
						inputType="email"
						placeholder="you@store.com"
						recipients={emailRecipients}
						{authFetch}
						onchange={loadRecipients}
					/>
					{#if emailEnabled && emailRecipients.filter((r) => r.verified).length === 0}
						<p class="hint">Add and verify at least one address to receive email alerts.</p>
					{/if}
				</div>
			</Card>

			<Card title="Slack alerts">
				<div class="form-stack">
					<Switch
						label="Slack"
						name="slackEnabled"
						checked={slackEnabled}
						onchange={(e) => (slackEnabled = (e.target as HTMLInputElement).checked)}
					/>
					<TextField
						label="Incoming webhook URL"
						name="slackWebhookUrl"
						value={slackWebhookUrl}
						placeholder="https://hooks.slack.com/services/…"
						helpText="In Slack: Apps → Incoming Webhooks → Add to a channel, then paste the URL here."
						oninput={(e) => (slackWebhookUrl = (e.target as HTMLInputElement).value)}
					/>
				</div>
			</Card>
		</div>
	{/if}
</Page>

<style>
	.settings-stack,
	.skeleton-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.error-list {
		margin: 0;
		padding-left: 18px;
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}
</style>
