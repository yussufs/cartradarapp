<script lang="ts">
	import { Button, TextField, Badge } from '$lib/components';

	interface RecipientView {
		id: string;
		channel: 'email';
		destination: string;
		verified: boolean;
		canResend: boolean;
	}

	interface Props {
		channel: 'email';
		recipients: RecipientView[];
		disabled?: boolean;
		inputType?: 'email' | 'text';
		placeholder?: string;
		authFetch: (path: string, init?: RequestInit) => Promise<Response>;
		onchange: () => Promise<void> | void;
	}

	let {
		channel,
		recipients,
		disabled = false,
		inputType = 'text',
		placeholder = '',
		authFetch,
		onchange
	}: Props = $props();

	let newDestination = $state('');
	let adding = $state(false);
	let addError = $state('');

	// Per-recipient UI state, keyed by recipient id
	let codeInputs = $state<Record<string, string>>({});
	let rowBusy = $state<Record<string, boolean>>({});
	let rowError = $state<Record<string, string>>({});
	let rowNotice = $state<Record<string, string>>({});

	async function add() {
		if (!newDestination.trim()) return;
		adding = true;
		addError = '';
		try {
			const response = await authFetch('/api/recipients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channel, destination: newDestination })
			});
			const data = await response.json();
			if (!response.ok) {
				addError = data.error ?? 'Could not add that recipient.';
				return;
			}
			newDestination = '';
			await onchange();
		} catch {
			addError = 'Could not add that recipient.';
		} finally {
			adding = false;
		}
	}

	async function verify(id: string) {
		const code = (codeInputs[id] ?? '').trim();
		if (!code) return;
		rowBusy[id] = true;
		rowError[id] = '';
		rowNotice[id] = '';
		try {
			const response = await authFetch(`/api/recipients/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});
			const data = await response.json();
			if (!response.ok) {
				rowError[id] = data.error ?? 'Verification failed.';
				return;
			}
			codeInputs[id] = '';
			await onchange();
		} catch {
			rowError[id] = 'Verification failed.';
		} finally {
			rowBusy[id] = false;
		}
	}

	async function resend(id: string) {
		rowBusy[id] = true;
		rowError[id] = '';
		rowNotice[id] = '';
		try {
			const response = await authFetch(`/api/recipients/${id}`, { method: 'POST' });
			const data = await response.json();
			if (!response.ok) {
				rowError[id] = data.error ?? 'Could not resend the code.';
				return;
			}
			rowNotice[id] = 'A new code is on its way.';
			await onchange();
		} catch {
			rowError[id] = 'Could not resend the code.';
		} finally {
			rowBusy[id] = false;
		}
	}

	async function remove(id: string) {
		rowBusy[id] = true;
		try {
			await authFetch(`/api/recipients/${id}`, { method: 'DELETE' });
			await onchange();
		} finally {
			rowBusy[id] = false;
		}
	}

	function onAddKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			add();
		}
	}
</script>

<div class="recipient-manager" class:disabled>
	<div class="add-row">
		<!-- keydown bubbles up from the inner input so Enter submits -->
		<div class="add-input" onkeydown={onAddKeydown} role="presentation">
			<TextField
				label="Add an email address"
				labelHidden
				name="add-{channel}"
				type={inputType}
				value={newDestination}
				{placeholder}
				{disabled}
				oninput={(e) => (newDestination = (e.target as HTMLInputElement).value)}
			/>
		</div>
		<Button onclick={add} loading={adding} {disabled}>Add</Button>
	</div>
	{#if addError}
		<p class="field-error">{addError}</p>
	{/if}

	{#if recipients.length > 0}
		<ul class="recipient-list">
			{#each recipients as recipient (recipient.id)}
				<li class="recipient-row">
					<div class="recipient-head">
						<span class="destination">{recipient.destination}</span>
						{#if recipient.verified}
							<Badge tone="success">Verified</Badge>
						{:else}
							<Badge tone="caution">Pending</Badge>
						{/if}
						<button
							type="button"
							class="remove"
							aria-label="Remove {recipient.destination}"
							disabled={rowBusy[recipient.id]}
							onclick={() => remove(recipient.id)}
						>
							×
						</button>
					</div>

					{#if !recipient.verified}
						<div class="verify-row">
							<input
								class="code-input"
								inputmode="numeric"
								maxlength="6"
								placeholder="6-digit code"
								aria-label="Verification code for {recipient.destination}"
								value={codeInputs[recipient.id] ?? ''}
								oninput={(e) => (codeInputs[recipient.id] = (e.target as HTMLInputElement).value)}
							/>
							<Button
								variant="primary"
								onclick={() => verify(recipient.id)}
								loading={rowBusy[recipient.id]}
							>
								Verify
							</Button>
							<Button
								variant="plain"
								disabled={!recipient.canResend || rowBusy[recipient.id]}
								onclick={() => resend(recipient.id)}
							>
								Resend code
							</Button>
						</div>
						{#if rowError[recipient.id]}
							<p class="field-error">{rowError[recipient.id]}</p>
						{/if}
						{#if rowNotice[recipient.id]}
							<p class="field-notice">{rowNotice[recipient.id]}</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.recipient-manager {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.recipient-manager.disabled {
		opacity: 0.6;
	}

	.add-row {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}

	.add-input {
		flex: 1;
	}

	.recipient-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.recipient-row {
		border: 1px solid var(--p-color-border, #e3e3e3);
		border-radius: 8px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.recipient-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.destination {
		font-weight: 500;
		flex: 1;
		word-break: break-all;
	}

	.remove {
		border: none;
		background: transparent;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		color: var(--p-color-text-secondary, #6d7175);
		padding: 0 4px;
	}

	.remove:hover:not(:disabled) {
		color: var(--p-color-text-critical, #d72c0d);
	}

	.verify-row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.code-input {
		width: 120px;
		padding: 6px 10px;
		border: 1px solid var(--p-color-border, #c9cccf);
		border-radius: 8px;
		font-size: 14px;
		letter-spacing: 2px;
	}

	.field-error {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-critical, #d72c0d);
	}

	.field-notice {
		margin: 0;
		font-size: 13px;
		color: var(--p-color-text-success, #047b41);
	}
</style>
