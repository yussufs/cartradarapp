<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FullAutoFill } from 'svelte/elements';

	interface Props {
		label: string;
		name: string;
		value?: string;
		placeholder?: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
		disabled?: boolean;
		readonly?: boolean;
		error?: string;
		helpText?: string;
		prefix?: string | Snippet;
		suffix?: string | Snippet;
		multiline?: boolean;
		rows?: number;
		maxLength?: number;
		autoComplete?: FullAutoFill;
		labelHidden?: boolean;
		required?: boolean;
		step?: string;
		min?: string;
		max?: string;
		oninput?: (event: Event) => void;
		onchange?: (event: Event) => void;
		onblur?: (event: Event) => void;
		onfocus?: (event: Event) => void;
	}

	let {
		label,
		name,
		value = '',
		placeholder = '',
		type = 'text',
		disabled = false,
		readonly = false,
		error,
		helpText,
		prefix,
		suffix,
		multiline = false,
		rows = 3,
		maxLength,
		autoComplete,
		labelHidden = false,
		required = false,
		step,
		min,
		max,
		oninput,
		onchange,
		onblur,
		onfocus
	}: Props = $props();

	const inputId = `input-${name}-${Math.random().toString(36).substring(7)}`;
</script>

<div class="text-field" class:has-error={error} class:disabled>
	<label for={inputId} class="label" class:visually-hidden={labelHidden}>
		{label}
		{#if required}
			<span class="required">*</span>
		{/if}
	</label>
	<div class="input-wrapper">
		{#if prefix}
			<span class="prefix">
				{#if typeof prefix === 'string'}
					{prefix}
				{:else}
					{@render prefix()}
				{/if}
			</span>
		{/if}
		{#if multiline}
			<textarea
				id={inputId}
				{name}
				{value}
				{placeholder}
				{disabled}
				{readonly}
				{rows}
				maxlength={maxLength}
				autocomplete={autoComplete}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
				class="input"
				{oninput}
				{onchange}
				{onblur}
				{onfocus}
			></textarea>
		{:else}
			<input
				id={inputId}
				{name}
				{type}
				{value}
				{placeholder}
				{disabled}
				{readonly}
				maxlength={maxLength}
				autocomplete={autoComplete}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
				class="input"
				{step}
				{min}
				{max}
				{oninput}
				{onchange}
				{onblur}
				{onfocus}
			/>
		{/if}
		{#if suffix}
			<span class="suffix">
				{#if typeof suffix === 'string'}
					{suffix}
				{:else}
					{@render suffix()}
				{/if}
			</span>
		{/if}
	</div>
	{#if error}
		<p id="{inputId}-error" class="error-text">{error}</p>
	{:else if helpText}
		<p id="{inputId}-help" class="help-text">{helpText}</p>
	{/if}
</div>

<style>
	.text-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-100);
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-text);
	}

	.label.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.required {
		color: var(--color-text-critical);
	}

	.input-wrapper {
		display: flex;
		align-items: stretch;
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition:
			border-color var(--duration-fast) var(--ease-default),
			box-shadow var(--duration-fast) var(--ease-default);
	}

	.input-wrapper:focus-within {
		border-color: var(--color-border-focus);
		box-shadow: 0 0 0 1px var(--color-border-focus);
	}

	.has-error .input-wrapper {
		border-color: var(--color-border-critical);
	}

	.has-error .input-wrapper:focus-within {
		box-shadow: 0 0 0 1px var(--color-border-critical);
	}

	.disabled .input-wrapper {
		background: var(--color-bg-surface-secondary);
		cursor: not-allowed;
	}

	.prefix,
	.suffix {
		display: flex;
		align-items: center;
		padding: 0 var(--space-300);
		background: var(--color-bg-surface-secondary);
		color: var(--color-text-secondary);
		font-size: var(--font-size-md);
		white-space: nowrap;
	}

	.prefix {
		border-right: 1px solid var(--color-border);
	}

	.suffix {
		border-left: 1px solid var(--color-border);
	}

	.input {
		flex: 1;
		width: 100%;
		padding: var(--space-200) var(--space-300);
		font-family: inherit;
		font-size: var(--font-size-md);
		color: var(--color-text);
		background: transparent;
		border: none;
		outline: none;
		min-height: 36px;
	}

	.input::placeholder {
		color: var(--color-text-disabled);
	}

	.input:disabled {
		color: var(--color-text-disabled);
		cursor: not-allowed;
	}

	textarea.input {
		resize: vertical;
		min-height: 80px;
	}

	.error-text {
		font-size: var(--font-size-sm);
		color: var(--color-text-critical);
		margin: 0;
	}

	.help-text {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin: 0;
	}
</style>
