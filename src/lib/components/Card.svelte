<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		padding?: 'none' | 'tight' | 'base' | 'loose';
		children: Snippet;
		actions?: Snippet;
		footer?: Snippet;
	}

	let { title, subtitle, padding = 'base', children, actions, footer }: Props = $props();
</script>

<div class="card">
	{#if title || actions}
		<div class="card-header">
			<div class="card-header-content">
				{#if title}
					<h2 class="card-title">{title}</h2>
				{/if}
				{#if subtitle}
					<p class="card-subtitle">{subtitle}</p>
				{/if}
			</div>
			{#if actions}
				<div class="card-actions">
					{@render actions()}
				</div>
			{/if}
		</div>
	{/if}
	<div
		class="card-body"
		class:padding-none={padding === 'none'}
		class:padding-tight={padding === 'tight'}
		class:padding-loose={padding === 'loose'}
	>
		{@render children()}
	</div>
	{#if footer}
		<div class="card-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.card {
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-400);
		padding: var(--space-400);
		border-bottom: 1px solid var(--color-border);
	}

	.card-header-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-100);
	}

	.card-title {
		font-size: var(--font-size-400);
		font-weight: var(--font-weight-semibold);
		letter-spacing: -0.0125rem;
		line-height: 1.25rem;
		margin: 0;
	}

	.card-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
		margin: 0;
	}

	.card-actions {
		display: flex;
		gap: var(--space-200);
	}

	.card-body {
		padding: var(--space-400);
	}

	.card-body.padding-none {
		padding: 0;
	}

	.card-body.padding-tight {
		padding: var(--space-300);
	}

	.card-body.padding-loose {
		padding: var(--space-600);
	}

	.card-footer {
		padding: var(--space-400);
		border-top: 1px solid var(--color-border);
	}
</style>
