<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let shop = $state('');

	const error = $derived(form?.error || data?.error);
</script>

<svelte:head>
	<title>Login - Shopify App</title>
	<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
	<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
</svelte:head>

<s-page>
	<form method="POST">
		<s-section heading="Log in">
			<s-text-field
				name="shop"
				label="Shop domain"
				details="example.myshopify.com"
				value={shop}
				oninput={(e: Event) => (shop = (e.currentTarget as HTMLInputElement).value)}
				autocomplete="on"
				error={error || undefined}
			></s-text-field>
			<s-button type="submit">Log in</s-button>
		</s-section>
	</form>
</s-page>
