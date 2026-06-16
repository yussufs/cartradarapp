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

	// Local working copy so add/delete reflect instantly (optimistic), then
	// reconcile with the server list whenever the parent reloads.
	let items = $state<RecipientView[]>([]);
	$effect(() => {
		items = Array.isArray(recipients) ? recipients : [];
	});

	// While any address is still pending, poll so it flips to Confirmed shortly
	// after the recipient clicks the link (which happens in their own inbox/tab).
	$effect(() => {
		if (!items.some((r) => !r.verified)) return;
		const timer = setInterval(() => {
			Promise.resolve(onchange()).catch(() => {
				// Keep polling best-effort; the parent load path surfaces real errors.
			});
		}, 4000);
		return () => clearInterval(timer);
	});

	let newDestination = $state('');
	let adding = $state(false);
	let addError = $state('');

	let rowBusy = $state<Record<string, boolean>>({});
	let rowError = $state<Record<string, string>>({});
	let rowNotice = $state<Record<string, string>>({});

	type ApiObject = Record<string, unknown>;

	function isObject(value: unknown): value is ApiObject {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	async function readJson(response: Response): Promise<unknown> {
		try {
			return await response.json();
		} catch {
			return null;
		}
	}

	function responseError(value: unknown, fallback: string): string {
		if (!isObject(value) || typeof value.error !== 'string') return fallback;
		return value.error;
	}

	async function add() {
		const dest = newDestination.trim();
		if (!dest) return;
		adding = true;
		addError = '';

		// Optimistic: show the pending row immediately.
		const tempId = `temp-${dest}`;
		items = [
			...items,
			{ id: tempId, channel, destination: dest, verified: false, canResend: false }
		];
		newDestination = '';

		try {
			const response = await authFetch('/api/recipients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channel, destination: dest })
			});
			const data = await readJson(response);
			if (!response.ok) {
				items = items.filter((i) => i.id !== tempId);
				newDestination = dest;
				addError = responseError(data, 'Could not add that recipient.');
				return;
			}
			await onchange(); // reload replaces the temp row with the real one
		} catch {
			items = items.filter((i) => i.id !== tempId);
			newDestination = dest;
			addError = 'Could not add that recipient.';
		} finally {
			adding = false;
		}
	}

	async function resend(id: string) {
		rowBusy[id] = true;
		rowError[id] = '';
		rowNotice[id] = '';
		try {
			const response = await authFetch(`/api/recipients/${id}`, { method: 'POST' });
			const data = await readJson(response);
			if (!response.ok) {
				rowError[id] = responseError(data, 'Could not resend the link.');
				return;
			}
			rowNotice[id] = 'A fresh confirmation link is on its way.';
			await onchange();
		} catch {
			rowError[id] = 'Could not resend the link.';
		} finally {
			rowBusy[id] = false;
		}
	}

	async function remove(id: string) {
		// Optimistic: drop the row immediately, restore on failure.
		const prev = items;
		items = items.filter((i) => i.id !== id);
		rowBusy[id] = true;
		try {
			const response = await authFetch(`/api/recipients/${id}`, { method: 'DELETE' });
			if (!response.ok) {
				items = prev;
				return;
			}
			await onchange();
		} catch {
			items = prev;
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

	{#if items.length > 0}
		<ul class="recipient-list">
			{#each items as recipient (recipient.id)}
				<li class="recipient-row">
					<div class="recipient-head">
						<span class="destination">{recipient.destination}</span>
						{#if recipient.verified}
							<Badge tone="success">Confirmed</Badge>
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
						<div class="pending-row">
							<span class="pending-hint">
								Confirmation link sent — they click it to start receiving alerts.
							</span>
							<Button
								variant="plain"
								disabled={!recipient.canResend || rowBusy[recipient.id]}
								onclick={() => resend(recipient.id)}
							>
								Resend link
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

	.pending-row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		justify-content: space-between;
	}

	.pending-hint {
		font-size: 13px;
		color: var(--p-color-text-secondary, #6d7175);
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
