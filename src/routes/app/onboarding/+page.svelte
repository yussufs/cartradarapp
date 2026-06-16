<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Page, Card, Button, TextField, Select, Badge, Banner, Skeleton } from '$lib/components';
	import RecipientManager from '../settings/RecipientManager.svelte';

	interface RecipientView {
		id: string;
		channel: 'email';
		destination: string;
		verified: boolean;
		canResend: boolean;
	}

	let step = $state(1);
	let isLoading = $state(true);
	let loadError = $state('');
	let saving = $state(false);
	let stepError = $state('');

	// Step 1 — alert rule
	let thresholdAmount = $state('250');
	let inactivityMinutes = $state('60');
	let attributionWindowDays = 14;
	let currency = $state('USD');

	// Step 2 — channels
	let emailEnabled = true;
	let slackEnabled = false;
	let slackConnected = $state(false);
	let slackChannelName = $state<string | null>(null);
	let slackWorking = $state(false);
	let slackNotice = $state('');
	let recipients = $state<RecipientView[]>([]);
	const emailRecipients = $derived(recipients.filter((r) => r.channel === 'email'));
	const hasConfirmedEmail = $derived(emailRecipients.some((r) => r.verified));
	const channelReady = $derived(hasConfirmedEmail || slackConnected);

	// Step 3 — test
	let testing = $state(false);
	let testResult = $state<{ sent: number; failed: number; errors: string[] } | null>(null);

	const inactivityOptions = [
		{ label: '15 minutes', value: '15' },
		{ label: '30 minutes', value: '30' },
		{ label: '1 hour (recommended)', value: '60' },
		{ label: '2 hours', value: '120' },
		{ label: '4 hours', value: '240' }
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
			if (settingsRes.ok) {
				const d = await settingsRes.json();
				if (d.rule?.thresholdAmount) thresholdAmount = String(d.rule.thresholdAmount);
				if (d.rule?.inactivityMinutes) inactivityMinutes = String(d.rule.inactivityMinutes);
				attributionWindowDays = d.attributionWindowDays ?? 14;
				emailEnabled = d.channels?.emailEnabled ?? true;
				slackEnabled = d.channels?.slackEnabled ?? false;
				slackConnected = d.channels?.slackConnected ?? false;
				slackChannelName = d.channels?.slackChannelName ?? null;
				currency = d.currency ?? 'USD';
			}
			// If we just came back from Slack OAuth, resume on the channels step.
			const slackResult = new URLSearchParams(window.location.search).get('slack');
			if (slackResult) {
				step = 2;
				if (slackResult === 'connected') {
					slackNotice = slackChannelName
						? `Slack connected — posting to ${slackChannelName}.`
						: 'Slack connected.';
				} else if (slackResult === 'denied') {
					slackNotice = 'Slack connection was cancelled.';
				} else {
					slackNotice = "Couldn't connect Slack. Please try again.";
				}
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load setup';
		} finally {
			isLoading = false;
		}
	});

	async function saveRuleAndContinue() {
		const threshold = parseFloat(thresholdAmount);
		if (!isFinite(threshold) || threshold <= 0) {
			stepError = 'Enter a cart value greater than 0.';
			return;
		}
		saving = true;
		stepError = '';
		try {
			const response = await authFetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rule: {
						enabled: true,
						thresholdAmount: threshold,
						minItemCount: null,
						inactivityMinutes: parseInt(inactivityMinutes, 10)
					},
					attributionWindowDays,
					channels: { emailEnabled, slackEnabled }
				})
			});
			if (!response.ok) {
				stepError = 'Could not save. Please try again.';
				return;
			}
			step = 2;
		} catch {
			stepError = 'Could not save. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function connectSlack() {
		slackWorking = true;
		slackNotice = '';
		try {
			const response = await authFetch('/api/slack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'connect', returnTo: '/app/onboarding' })
			});
			const data = await response.json();
			if (!response.ok) {
				slackNotice = data.error ?? 'Could not start Slack connection.';
				return;
			}
			window.open(data.url, '_top');
		} catch {
			slackNotice = 'Could not start Slack connection.';
		} finally {
			slackWorking = false;
		}
	}

	async function sendTest() {
		testing = true;
		testResult = null;
		try {
			const response = await authFetch('/api/alerts/test', { method: 'POST' });
			testResult = await response.json();
		} catch {
			testResult = { sent: 0, failed: 0, errors: ['Test alert request failed'] };
		} finally {
			testing = false;
		}
	}

	function money(value: number): string {
		try {
			return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
		} catch {
			return `${currency} ${value.toFixed(2)}`;
		}
	}

	function skip() {
		try {
			sessionStorage.setItem('cr_onboarding_skipped', '1');
		} catch {
			/* best effort */
		}
		goto('/app');
	}
</script>

<svelte:head>
	<title>Set up · Cart Radar</title>
</svelte:head>

<Page title="Set up Cart Radar" subtitle="Three quick steps and you're catching abandoned carts.">
	{#snippet secondaryActions()}
		<Button variant="plain" onclick={skip}>Skip for now</Button>
	{/snippet}

	{#if isLoading}
		<Card>
			<div class="stack">
				<Skeleton variant="text" width="40%" />
				<Skeleton variant="box" height="160px" />
			</div>
		</Card>
	{:else if loadError}
		<Banner tone="critical" title="Couldn't load setup"><p>{loadError}</p></Banner>
	{:else}
		<div class="stack">
			<ol class="steps">
				<li class:active={step === 1} class:done={step > 1}>1 · Alert rule</li>
				<li class:active={step === 2} class:done={step > 2}>2 · Where alerts go</li>
				<li class:active={step === 3}>3 · Done</li>
			</ol>

			{#if step === 1}
				<Card title="Which carts are worth an alert?">
					<div class="form-stack">
						<TextField
							label="Cart value threshold ({currency})"
							name="threshold"
							type="number"
							min="1"
							value={thresholdAmount}
							helpText="We'll alert you when an abandoned cart is worth at least this much."
							oninput={(e) => (thresholdAmount = (e.target as HTMLInputElement).value)}
						/>
						<Select
							label="How long before a cart counts as abandoned?"
							name="inactivity"
							options={inactivityOptions}
							value={inactivityMinutes}
							onchange={(e) => (inactivityMinutes = (e.target as HTMLSelectElement).value)}
						/>
						{#if stepError}<p class="field-error">{stepError}</p>{/if}
						<div>
							<Button variant="primary" loading={saving} onclick={saveRuleAndContinue}>
								Continue
							</Button>
						</div>
					</div>
				</Card>
			{:else if step === 2}
				<Card title="Where should alerts go?" subtitle="Connect at least one — email or Slack.">
					<div class="form-stack">
						{#if slackNotice}
							<Banner tone={slackConnected ? 'success' : 'warning'}>
								<p>{slackNotice}</p>
							</Banner>
						{/if}

						<div class="channel">
							<p class="channel-title">Email</p>
							<RecipientManager
								channel="email"
								inputType="email"
								placeholder="you@store.com"
								recipients={emailRecipients}
								{authFetch}
								onchange={loadRecipients}
							/>
							{#if emailRecipients.length > 0 && !hasConfirmedEmail}
								<p class="hint">
									Click the confirmation link we emailed to finish adding an address.
								</p>
							{/if}
						</div>

						<div class="channel">
							<p class="channel-title">Slack</p>
							{#if slackConnected}
								<Badge tone="success">
									Connected{slackChannelName ? ` · ${slackChannelName}` : ''}
								</Badge>
							{:else}
								<Button loading={slackWorking} onclick={connectSlack}>Connect Slack</Button>
							{/if}
						</div>

						{#if !channelReady}
							<p class="hint">Add a confirmed email or connect Slack to continue.</p>
						{/if}

						<div class="nav-row">
							<Button variant="plain" onclick={() => (step = 1)}>Back</Button>
							<Button variant="primary" disabled={!channelReady} onclick={() => (step = 3)}>
								Continue
							</Button>
						</div>
					</div>
				</Card>
			{:else}
				<Card title="You're all set 🎉">
					<div class="form-stack">
						<p>
							Cart Radar will alert you when a cart worth at least
							<strong>{money(parseFloat(thresholdAmount) || 0)}</strong> is abandoned, delivered to
							{hasConfirmedEmail ? 'email' : ''}{hasConfirmedEmail && slackConnected
								? ' and '
								: ''}{slackConnected ? 'Slack' : ''}.
						</p>

						{#if testResult}
							<Banner
								tone={testResult.failed > 0 || testResult.errors.length > 0 ? 'warning' : 'success'}
							>
								<p>
									{testResult.sent} sent, {testResult.failed} failed.
									{#if testResult.errors.length > 0}{testResult.errors.join(' · ')}{/if}
								</p>
							</Banner>
						{/if}

						<div class="nav-row">
							<Button loading={testing} onclick={sendTest}>Send a test alert</Button>
							<Button variant="primary" onclick={() => goto('/app')}>Go to dashboard</Button>
						</div>
					</div>
				</Card>
			{/if}
		</div>
	{/if}
</Page>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.steps li {
		font-size: 13px;
		font-weight: 550;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--p-color-bg-surface-secondary, #f6f6f7);
		color: var(--p-color-text-secondary, #6d7175);
		border: 1px solid var(--p-color-border, #e3e3e3);
	}

	.steps li.active {
		background: var(--p-color-bg-surface, #ffffff);
		color: var(--p-color-text, #202223);
		border-color: var(--p-color-border-emphasis, #1a1a1a);
	}

	.steps li.done {
		color: var(--p-color-text-success, #047b41);
	}

	.channel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--p-color-border, #e3e3e3);
	}

	.channel:last-of-type {
		border-bottom: none;
		padding-bottom: 0;
	}

	.channel-title {
		margin: 0;
		font-weight: 600;
	}

	.nav-row {
		display: flex;
		gap: 8px;
		justify-content: space-between;
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
	}

	.field-error {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-critical, #d72c0d);
	}
</style>
