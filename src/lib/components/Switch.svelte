<script lang="ts">
	interface Props {
		label: string;
		name: string;
		checked?: boolean;
		disabled?: boolean;
		helpText?: string;
		onchange?: (event: Event) => void;
	}

	let { label, name, checked = false, disabled = false, helpText, onchange }: Props = $props();

	const switchId = `switch-${name}-${Math.random().toString(36).substring(7)}`;
</script>

<div class="switch-field" class:disabled>
	<label class="switch-label" for={switchId}>
		<span class="switch-text">
			<span class="switch-label-text">{label}</span>
			{#if helpText}
				<span id="{switchId}-help" class="help-text">{helpText}</span>
			{/if}
		</span>
		<input
			type="checkbox"
			role="switch"
			id={switchId}
			{name}
			{checked}
			{disabled}
			aria-describedby={helpText ? `${switchId}-help` : undefined}
			class="switch-input"
			{onchange}
		/>
		<span class="switch-track">
			<span class="switch-thumb"></span>
		</span>
	</label>
</div>

<style>
	.switch-field {
		display: flex;
	}

	.switch-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-400);
		cursor: pointer;
		width: 100%;
	}

	.disabled .switch-label {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.switch-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-050);
	}

	.switch-label-text {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-medium);
		color: var(--color-text);
	}

	.help-text {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.switch-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.switch-track {
		position: relative;
		flex-shrink: 0;
		width: 44px;
		height: 24px;
		background: var(--color-bg-fill-secondary);
		border-radius: var(--radius-full);
		transition: background-color var(--duration-base) var(--ease-default);
	}

	.switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: var(--color-bg-surface);
		border-radius: 50%;
		box-shadow: var(--shadow-sm);
		transition: transform var(--duration-base) var(--ease-default);
	}

	.switch-input:checked + .switch-track {
		background: var(--color-bg-fill-success);
	}

	.switch-input:checked + .switch-track .switch-thumb {
		transform: translateX(20px);
	}

	.switch-input:focus-visible + .switch-track {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}
</style>
