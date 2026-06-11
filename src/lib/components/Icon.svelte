<script lang="ts">
	interface Props {
		name:
			| 'chevron-down'
			| 'chevron-up'
			| 'chevron-left'
			| 'chevron-right'
			| 'x'
			| 'search'
			| 'filter'
			| 'plus'
			| 'minus'
			| 'check'
			| 'arrow-up'
			| 'arrow-down'
			| 'external'
			| 'image'
			| 'download'
			| 'edit'
			| 'delete'
			| 'more';
		size?: 'small' | 'medium' | 'large';
		tone?: 'default' | 'subdued' | 'success' | 'critical' | 'warning';
	}

	let { name, size = 'medium', tone = 'default' }: Props = $props();

	const icons: Record<string, string> = {
		'chevron-down':
			'M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z',
		'chevron-up':
			'M14.707 12.707a1 1 0 0 1-1.414 0L10 9.414l-3.293 3.293a1 1 0 0 1-1.414-1.414l4-4a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414Z',
		'chevron-left':
			'M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z',
		'chevron-right':
			'M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z',
		x: 'M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z',
		search:
			'M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.816-4.816A6 6 0 0 1 2 8Z',
		filter:
			'M3 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm2 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Zm3 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H8Z',
		plus: 'M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z',
		minus: 'M4 10a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z',
		check:
			'M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z',
		'arrow-up':
			'M10 3a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-1.414 1.414L11 6.414V16a1 1 0 1 1-2 0V6.414L6.707 8.707a1 1 0 0 1-1.414-1.414l4-4A1 1 0 0 1 10 3Z',
		'arrow-down':
			'M10 17a1 1 0 0 1-.707-.293l-4-4a1 1 0 1 1 1.414-1.414L9 13.586V4a1 1 0 1 1 2 0v9.586l2.293-2.293a1 1 0 0 1 1.414 1.414l-4 4A1 1 0 0 1 10 17Z',
		external:
			'M14.5 10a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75v-9a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H6.5v7h7v-2.25a.75.75 0 0 1 .75-.75Zm-3.75-4.25a.75.75 0 0 1 0-1.5h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.06l-4.72 4.72a.75.75 0 1 1-1.06-1.06l4.72-4.72h-2.69Z',
		image:
			'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2-.5a.5.5 0 0 0-.5.5v6.636l2.293-2.293a1 1 0 0 1 1.414 0L10.5 11.64l1.793-1.793a1 1 0 0 1 1.414 0l1.793 1.793V5a.5.5 0 0 0-.5-.5H5Zm9.793 10.5L13 13.207l-1.793 1.793H14.5a.5.5 0 0 0 .293-.5ZM4.5 15a.5.5 0 0 0 .5.5h3.793L5.5 12.207 4.5 13.207V15ZM13 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
		download:
			'M10 3a1 1 0 0 1 1 1v6.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 10.586V4a1 1 0 0 1 1-1ZM4 15a1 1 0 0 1 1 1v.5h10V16a1 1 0 1 1 2 0v1.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V16a1 1 0 0 1 1-1Z',
		edit: 'M14.846 1.403a2.45 2.45 0 0 1 3.465 3.465l-.308.308-3.465-3.465.308-.308Zm-1.261 1.261L1.464 14.785A1.5 1.5 0 0 0 1 15.846V18h2.153a1.5 1.5 0 0 0 1.062-.44l12.12-12.12-3.465-3.466-.285.29Z',
		delete:
			'M8.75 1h2.5a1 1 0 0 1 1 1H7.75a1 1 0 0 1 1-1ZM4 4.5V5h12v-.5a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5ZM6.5 18a2 2 0 0 1-2-1.975L4 6h12l-.5 10.025A2 2 0 0 1 13.5 18h-7Zm.75-9a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 7.25 9Zm5.5 0a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5a.75.75 0 0 0-.75-.75Z',
		more: 'M6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'
	};
</script>

<svg
	viewBox="0 0 20 20"
	fill="currentColor"
	class="icon"
	class:small={size === 'small'}
	class:large={size === 'large'}
	class:subdued={tone === 'subdued'}
	class:success={tone === 'success'}
	class:critical={tone === 'critical'}
	class:warning={tone === 'warning'}
	aria-hidden="true"
>
	<path fill-rule="evenodd" d={icons[name]} clip-rule="evenodd" />
</svg>

<style>
	.icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.icon.small {
		width: 16px;
		height: 16px;
	}

	.icon.large {
		width: 24px;
		height: 24px;
	}

	.icon.subdued {
		color: var(--color-icon-secondary);
	}

	.icon.success {
		color: var(--color-icon-success);
	}

	.icon.critical {
		color: var(--color-icon-critical);
	}

	.icon.warning {
		color: var(--color-icon-warning);
	}
</style>
