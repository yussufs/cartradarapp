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

	type ApiObject = Record<string, unknown>;

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
	let slackConnected = $state(false);
	let slackChannelName = $state<string | null>(null);
	let slackWorking = $state(false);
	let slackNotice = $state<{ tone: 'success' | 'warning'; text: string } | null>(null);

	// Recipients (managed independently of the form save)
	let recipients = $state<RecipientView[]>([]);
	const emailRecipients = $derived(recipients.filter((r) => r.channel === 'email'));
	const confirmedEmailCount = $derived(emailRecipients.filter((r) => r.verified).length);

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

	function isObject(value: unknown): value is ApiObject {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	function stringValue(value: unknown, fallback = ''): string {
		return typeof value === 'string' ? value : fallback;
	}

	function booleanValue(value: unknown, fallback = false): boolean {
		return typeof value === 'boolean' ? value : fallback;
	}

	function numberString(value: unknown, fallback: string): string {
		const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
		return Number.isFinite(parsed) ? String(parsed) : fallback;
	}

	function errorMessages(value: unknown, fallback: string): string[] {
		if (!isObject(value)) return [fallback];
		if (Array.isArray(value.errors)) {
			const messages = value.errors.filter((error): error is string => typeof error === 'string');
			if (messages.length > 0) return messages;
		}
		return [stringValue(value.error, fallback)];
	}

	async function readJson(response: Response): Promise<unknown> {
		try {
			return await response.json();
		} catch {
			return null;
		}
	}

	function toRecipient(value: unknown): RecipientView | null {
		if (!isObject(value)) return null;
		const id = stringValue(value.id);
		const destination = stringValue(value.destination);
		if (!id || value.channel !== 'email' || !destination) return null;
		return {
			id,
			channel: 'email',
			destination,
			verified: booleanValue(value.verified),
			canResend: booleanValue(value.canResend)
		};
	}

	function toTestResult(value: unknown, responseOk: boolean) {
		const payload = isObject(value) ? value : {};
		const errors = Array.isArray(payload.errors)
			? payload.errors.filter((error): error is string => typeof error === 'string')
			: [];
		if (!responseOk && errors.length === 0) errors.push(stringValue(payload.error, 'Test alert request failed'));
		return {
			sent: Number(payload.sent ?? 0) || 0,
			failed: Number(payload.failed ?? (responseOk ? 0 : 1)) || 0,
			errors
		};
	}

	async function authFetch(path: string, init?: RequestInit): Promise<Response> {
		if (typeof window.shopify?.idToken !== 'function') {
			throw new Error('Shopify App Bridge is not ready. Refresh the embedded app and try again.');
		}
		const token = await window.shopify.idToken();
		return fetch(path, {
			...init,
			headers: { ...init?.headers, Authorization: `Bearer ${token}` }
		});
	}

	async function loadRecipients() {
		const response = await authFetch('/api/recipients');
		const data = await readJson(response);
		if (!response.ok) {
			throw new Error(`Failed to load recipients (${response.status})`);
		}
		const rawRecipients = isObject(data) && Array.isArray(data.recipients) ? data.recipients : [];
		recipients = rawRecipients.map(toRecipient).filter((recipient): recipient is RecipientView => !!recipient);
	}

	onMount(async () => {
		try {
			const [settingsRes] = await Promise.all([authFetch('/api/settings'), loadRecipients()]);
			if (!settingsRes.ok) throw new Error(`Failed to load settings (${settingsRes.status})`);
			const data = await readJson(settingsRes);
			if (!isObject(data) || !isObject(data.rule) || !isObject(data.channels)) {
				throw new Error('Settings response was incomplete');
			}

			ruleEnabled = booleanValue(data.rule.enabled, ruleEnabled);
			thresholdAmount = numberString(data.rule.thresholdAmount, thresholdAmount);
			minItemCount =
				data.rule.minItemCount === null || data.rule.minItemCount === undefined
					? ''
					: numberString(data.rule.minItemCount, minItemCount);
			inactivityMinutes = numberString(data.rule.inactivityMinutes, inactivityMinutes);
			attributionWindowDays = numberString(data.attributionWindowDays, attributionWindowDays);

			emailEnabled = booleanValue(data.channels.emailEnabled, emailEnabled);
			slackEnabled = booleanValue(data.channels.slackEnabled, slackEnabled);
			slackConnected = booleanValue(data.channels.slackConnected, slackConnected);
			slackChannelName =
				typeof data.channels.slackChannelName === 'string' ? data.channels.slackChannelName : null;

			currency = stringValue(data.currency, currency);

			// Surface the result of a just-completed Slack OAuth round-trip.
			const slackResult = new URLSearchParams(window.location.search).get('slack');
			if (slackResult === 'connected') {
				slackNotice = {
					tone: 'success',
					text: slackChannelName
						? `Slack connected — alerts will post to ${slackChannelName}.`
						: 'Slack connected.'
				};
			} else if (slackResult === 'denied') {
				slackNotice = { tone: 'warning', text: 'Slack connection was cancelled.' };
			} else if (slackResult === 'error') {
				slackNotice = { tone: 'warning', text: "Couldn't connect Slack. Please try again." };
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load settings';
		} finally {
			isLoading = false;
		}
	});

	async function connectSlack() {
		slackWorking = true;
		slackNotice = null;
		try {
			const response = await authFetch('/api/slack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'connect', returnTo: '/app/settings' })
			});
			const data = await readJson(response);
			if (!response.ok) {
				slackNotice = {
					tone: 'warning',
					text: errorMessages(data, 'Could not start Slack connection.')[0]
				};
				return;
			}
			if (!isObject(data) || typeof data.url !== 'string') {
				slackNotice = { tone: 'warning', text: 'Could not start Slack connection.' };
				return;
			}
			// Break out of the Shopify iframe to Slack's consent screen.
			window.open(data.url, '_top');
		} catch {
			slackNotice = { tone: 'warning', text: 'Could not start Slack connection.' };
		} finally {
			slackWorking = false;
		}
	}

	async function disconnectSlack() {
		slackWorking = true;
		try {
			const response = await authFetch('/api/slack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'disconnect' })
			});
			if (response.ok) {
				slackConnected = false;
				slackEnabled = false;
				slackChannelName = null;
				window.shopify?.toast?.show('Slack disconnected');
			}
		} finally {
			slackWorking = false;
		}
	}

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
						slackEnabled
					}
				})
			});
			if (response.status === 422) {
				saveErrors = errorMessages(await readJson(response), 'Check the settings and try again.');
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
			testResult = toTestResult(await readJson(response), response.ok);
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
				subtitle="Each address gets a confirmation link by email — they click it to start receiving alerts."
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
					{#if emailEnabled && confirmedEmailCount === 0}
						<p class="hint">Add and confirm at least one address to receive email alerts.</p>
					{/if}
				</div>
			</Card>

			<Card
				title="Slack alerts"
				subtitle="Connect Slack and pick a channel — alerts post there automatically."
			>
				<div class="form-stack">
					{#if slackNotice}
						<Banner tone={slackNotice.tone} dismissible ondismiss={() => (slackNotice = null)}>
							<p>{slackNotice.text}</p>
						</Banner>
					{/if}

					{#if slackConnected}
						<Switch
							label="Slack"
							name="slackEnabled"
							checked={slackEnabled}
							helpText={slackChannelName ? `Posting to ${slackChannelName}` : 'Connected'}
							onchange={(e) => (slackEnabled = (e.target as HTMLInputElement).checked)}
						/>
						<div class="slack-row">
							<Button loading={slackWorking} onclick={disconnectSlack}>Disconnect Slack</Button>
						</div>
					{:else}
						<p class="hint">No Slack workspace connected yet.</p>
						<div class="slack-row">
							<Button variant="primary" loading={slackWorking} onclick={connectSlack}>
								Connect Slack
							</Button>
						</div>
					{/if}
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
