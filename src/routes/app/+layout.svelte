<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(() => {
		// Handle Polaris navigation events for SvelteKit
		const handleNavigate = (event: Event) => {
			const target = event.target as HTMLElement;
			const href = target.getAttribute('href');
			if (href && href.startsWith('/')) {
				event.preventDefault();
				goto(href);
			}
		};

		document.addEventListener('shopify:navigate', handleNavigate);

		return () => {
			document.removeEventListener('shopify:navigate', handleNavigate);
		};
	});
</script>

<svelte:head>
	<meta name="shopify-api-key" content={data.apiKey} />
	<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
	<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
</svelte:head>

<s-app-nav>
	<s-link href="/app">Home</s-link>
	<s-link href="/app/products">Products</s-link>
</s-app-nav>

{@render children()}
