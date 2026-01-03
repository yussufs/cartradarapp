<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';

	let { form }: { form: ActionData } = $props();
	let isLoading = $state(false);

	function handleSubmit() {
		isLoading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			isLoading = false;
			if (form?.success && form?.product) {
				window.shopify?.toast.show('Product created');
			}
		};
	}

	function editProduct() {
		if (form?.product?.id) {
			// @ts-expect-error - shopify types
			window.shopify?.intents?.invoke?.('edit:shopify/Product', {
				value: form.product.id
			});
		}
	}
</script>

<svelte:head>
	<title>Shopify App - Home</title>
</svelte:head>

<s-page heading="SvelteKit Shopify app template">
	<form method="POST" action="?/createProduct" use:enhance={handleSubmit} slot="primary-action">
		<s-button type="submit">Generate a product</s-button>
	</form>

	<s-section heading="Congrats on creating a new Shopify app">
		<s-paragraph>
			This embedded app template uses
			<s-link href="https://shopify.dev/docs/apps/tools/app-bridge" target="_blank">
				App Bridge
			</s-link>
			interface examples like an
			<s-link href="/app/additional">additional page in the app nav</s-link>, as well as an
			<s-link href="https://shopify.dev/docs/api/admin-graphql" target="_blank">
				Admin GraphQL
			</s-link>
			mutation demo, to provide a starting point for app development.
		</s-paragraph>
	</s-section>

	<s-section heading="Get started with products">
		<s-paragraph>
			Generate a product with GraphQL and get the JSON output for that product. Learn more about the
			<s-link
				href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
				target="_blank"
			>
				productCreate
			</s-link>
			mutation in our API references.
		</s-paragraph>

		<s-stack direction="inline" gap="base">
			<form method="POST" action="?/createProduct" use:enhance={handleSubmit}>
				<s-button type="submit" loading={isLoading ? true : undefined}>
					Generate a product
				</s-button>
			</form>
			{#if form?.product}
				<s-button onclick={editProduct} variant="tertiary">Edit product</s-button>
			{/if}
		</s-stack>

		{#if form?.error}
			<s-banner tone="critical" heading="Error">
				{form.error}
			</s-banner>
		{/if}

		{#if form?.product}
			<s-section heading="productCreate mutation">
				<s-stack direction="block" gap="base">
					<s-box padding="base" border-width="base" border-radius="base" background="subdued">
						<pre style="margin: 0;"><code>{JSON.stringify(form.product, null, 2)}</code></pre>
					</s-box>

					{#if form.variant}
						<s-heading>productVariantsBulkUpdate mutation</s-heading>
						<s-box padding="base" border-width="base" border-radius="base" background="subdued">
							<pre style="margin: 0;"><code>{JSON.stringify(form.variant, null, 2)}</code></pre>
						</s-box>
					{/if}
				</s-stack>
			</s-section>
		{/if}
	</s-section>

	<s-section slot="aside" heading="App template specs">
		<s-paragraph>
			<s-text>Framework: </s-text>
			<s-link href="https://svelte.dev/" target="_blank">SvelteKit</s-link>
		</s-paragraph>
		<s-paragraph>
			<s-text>Interface: </s-text>
			<s-link
				href="https://shopify.dev/docs/api/app-home/using-polaris-components"
				target="_blank"
			>
				Polaris web components
			</s-link>
		</s-paragraph>
		<s-paragraph>
			<s-text>API: </s-text>
			<s-link href="https://shopify.dev/docs/api/admin-graphql" target="_blank">GraphQL</s-link>
		</s-paragraph>
		<s-paragraph>
			<s-text>Database: </s-text>
			<s-link href="https://orm.drizzle.team/" target="_blank">Drizzle ORM</s-link>
		</s-paragraph>
	</s-section>

	<s-section slot="aside" heading="Next steps">
		<s-unordered-list>
			<s-list-item>
				Build an
				<s-link
					href="https://shopify.dev/docs/apps/getting-started/build-app-example"
					target="_blank"
				>
					example app
				</s-link>
			</s-list-item>
			<s-list-item>
				Explore Shopify's API with
				<s-link href="https://shopify.dev/docs/apps/tools/graphiql-admin-api" target="_blank">
					GraphiQL
				</s-link>
			</s-list-item>
		</s-unordered-list>
	</s-section>
</s-page>
