<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		tone?: 'default' | 'success' | 'warning' | 'critical' | 'info';
		dismissible?: boolean;
		children: Snippet;
		actions?: Snippet;
		ondismiss?: () => void;
	}

	let {
		title,
		tone = 'default',
		dismissible = false,
		children,
		actions,
		ondismiss
	}: Props = $props();

	function getIcon() {
		switch (tone) {
			case 'success':
				return 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z';
			case 'warning':
				return 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92ZM10 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z';
			case 'critical':
				return 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293Z';
			case 'info':
				return 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z';
			default:
				return 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z';
		}
	}
</script>

<div
	class="banner"
	class:success={tone === 'success'}
	class:warning={tone === 'warning'}
	class:critical={tone === 'critical'}
	class:info={tone === 'info'}
	role="status"
>
	<span class="banner-icon">
		<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
			<path fill-rule="evenodd" d={getIcon()} clip-rule="evenodd" />
		</svg>
	</span>
	<div class="banner-content">
		{#if title}
			<p class="banner-title">{title}</p>
		{/if}
		<div class="banner-message">
			{@render children()}
		</div>
		{#if actions}
			<div class="banner-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if dismissible && ondismiss}
		<button type="button" class="banner-dismiss" onclick={ondismiss} aria-label="Dismiss">
			<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-200);
		padding: var(--space-300);
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		border-left: 4px solid var(--color-border);
		box-shadow: var(--shadow-card);
	}

	.banner.success {
		border-left-color: var(--color-bg-fill-success);
		background: var(--color-bg-surface-success);
	}

	.banner.success .banner-icon {
		color: var(--color-icon-success);
	}

	.banner.warning {
		border-left-color: var(--color-bg-fill-warning);
		background: var(--color-bg-surface-warning);
	}

	.banner.warning .banner-icon {
		color: var(--color-icon-warning);
	}

	.banner.critical {
		border-left-color: var(--color-bg-fill-critical);
		background: var(--color-bg-surface-critical);
	}

	.banner.critical .banner-icon {
		color: var(--color-icon-critical);
	}

	.banner.info {
		border-left-color: var(--color-bg-fill-info);
		background: var(--color-bg-surface-info);
	}

	.banner.info .banner-icon {
		color: var(--color-icon-info);
	}

	.banner-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		/* match the message line-height so the icon centers on the first line */
		height: var(--line-height-500);
		color: var(--color-text-secondary);
	}

	.banner-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-200);
	}

	.banner-title {
		font-weight: var(--font-weight-semibold);
		line-height: var(--line-height-500);
		margin: 0;
	}

	.banner-message {
		font-size: var(--font-size-md);
		line-height: var(--line-height-500);
		color: var(--color-text);
	}

	/* Callers pass block elements (<p>, <ul>) whose default margins would push
	   the text off-center from the icon and inflate the banner height. */
	.banner-message > :global(:first-child) {
		margin-top: 0;
	}

	.banner-message > :global(:last-child) {
		margin-bottom: 0;
	}

	.banner-actions {
		display: flex;
		gap: var(--space-200);
		margin-top: var(--space-100);
	}

	.banner-dismiss {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		/* center the button on the first line of text */
		margin: calc((var(--line-height-500) - 28px) / 2) 0;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--ease-default),
			color var(--duration-fast) var(--ease-default);
	}

	.banner-dismiss:hover {
		background: rgba(0, 0, 0, 0.05);
		color: var(--color-text);
	}

	.banner-dismiss:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}
</style>
