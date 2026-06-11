<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		as?: 'span' | 'p' | 'div' | 'label';
		variant?:
			| 'bodyMd'
			| 'bodySm'
			| 'bodyLg'
			| 'headingXs'
			| 'headingSm'
			| 'headingMd'
			| 'headingLg'
			| 'headingXl';
		tone?: 'default' | 'subdued' | 'success' | 'critical' | 'warning';
		fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
		alignment?: 'start' | 'center' | 'end';
		truncate?: boolean;
		children: Snippet;
	}

	let {
		as = 'span',
		variant = 'bodyMd',
		tone = 'default',
		fontWeight,
		alignment,
		truncate = false,
		children
	}: Props = $props();
</script>

<svelte:element
	this={as}
	class="text"
	class:body-sm={variant === 'bodySm'}
	class:body-md={variant === 'bodyMd'}
	class:body-lg={variant === 'bodyLg'}
	class:heading-xs={variant === 'headingXs'}
	class:heading-sm={variant === 'headingSm'}
	class:heading-md={variant === 'headingMd'}
	class:heading-lg={variant === 'headingLg'}
	class:heading-xl={variant === 'headingXl'}
	class:subdued={tone === 'subdued'}
	class:success={tone === 'success'}
	class:critical={tone === 'critical'}
	class:warning={tone === 'warning'}
	class:weight-medium={fontWeight === 'medium'}
	class:weight-semibold={fontWeight === 'semibold'}
	class:weight-bold={fontWeight === 'bold'}
	class:align-center={alignment === 'center'}
	class:align-end={alignment === 'end'}
	class:truncate
>
	{@render children()}
</svelte:element>

<style>
	.text {
		margin: 0;
		font-family: inherit;
	}

	/* Body variants */
	.body-sm {
		font-size: var(--font-size-300);
		line-height: 1rem;
		letter-spacing: 0;
	}

	.body-md {
		font-size: var(--font-size-300);
		line-height: 1rem;
		letter-spacing: 0;
	}

	@media (min-width: 48em) {
		.body-md {
			font-size: var(--font-size-350);
			line-height: 1.25rem;
			letter-spacing: -0.0125rem;
		}
	}

	.body-lg {
		font-size: var(--font-size-350);
		line-height: 1.25rem;
		letter-spacing: -0.0125rem;
	}

	/* Heading variants */
	.heading-xs {
		font-size: var(--font-size-300);
		font-weight: var(--font-weight-semibold);
		line-height: 1rem;
	}

	.heading-sm {
		font-size: var(--font-size-325);
		font-weight: var(--font-weight-semibold);
		line-height: 1.25rem;
	}

	.heading-md {
		font-size: var(--font-size-350);
		font-weight: var(--font-weight-semibold);
		line-height: 1.25rem;
	}

	.heading-lg {
		font-size: var(--font-size-500);
		font-weight: var(--font-weight-semibold);
		letter-spacing: -0.0125rem;
		line-height: 1.5rem;
	}

	.heading-xl {
		font-size: var(--font-size-600);
		font-weight: var(--font-weight-bold);
		letter-spacing: -0.0125rem;
		line-height: 2rem;
	}

	/* Tone */
	.subdued {
		color: var(--color-text-secondary);
	}

	.success {
		color: var(--color-text-success);
	}

	.critical {
		color: var(--color-text-critical);
	}

	.warning {
		color: var(--color-text-warning);
	}

	/* Font weight */
	.weight-medium {
		font-weight: var(--font-weight-medium);
	}

	.weight-semibold {
		font-weight: var(--font-weight-semibold);
	}

	.weight-bold {
		font-weight: var(--font-weight-bold);
	}

	/* Alignment */
	.align-center {
		text-align: center;
	}

	.align-end {
		text-align: right;
	}

	/* Truncate */
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
