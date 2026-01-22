<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { Page, Card, Button, Banner, Text, Link } from '$lib/components';

	let { form }: { form: ActionData } = $props();
	let isLoading = $state(false);

	function handleSubmit() {
		isLoading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			isLoading = false;
			if (form?.success && form?.product) {
				window.shopify.toast.show('Product created');
			}
		};
	}

	function editProduct() {
		if (form?.product?.id) {
			window.shopify?.intents?.invoke?.('edit:shopify/Product', {
				value: form.product.id
			});
		}
	}
</script>

<svelte:head>
	<title>Template Info</title>
</svelte:head>

<Page title="SvelteKit Shopify app template">
	{#snippet primaryAction()}
		<form method="POST" action="?/createProduct" use:enhance={handleSubmit}>
			<Button variant="primary" type="submit" loading={isLoading}>Generate a product</Button>
		</form>
	{/snippet}

	{#snippet aside()}
		<Card title="App template specs">
			<div class="specs-list">
				<p>
					<Text>Framework:</Text>
					<Link href="https://svelte.dev/" external>SvelteKit</Link>
				</p>
				<p>
					<Text>Interface:</Text>
					<Link href="https://shopify.dev/docs/api/app-home" external>
						Custom Components with App Bridge
					</Link>
				</p>
				<p>
					<Text>API:</Text>
					<Link href="https://shopify.dev/docs/api/admin-graphql" external>GraphQL</Link>
				</p>
				<p>
					<Text>Database:</Text>
					<Link href="https://orm.drizzle.team/" external>Drizzle ORM</Link>
				</p>
			</div>
		</Card>

		<Card title="Next steps">
			<ul class="next-steps">
				<li>
					Build an
					<Link href="https://shopify.dev/docs/apps/getting-started/build-app-example" external>
						example app
					</Link>
				</li>
				<li>
					Explore Shopify's API with
					<Link href="https://shopify.dev/docs/apps/tools/graphiql-admin-api" external>
						GraphiQL
					</Link>
				</li>
			</ul>
		</Card>
	{/snippet}

	<Card title="Congrats on creating a new Shopify app">
		<Text as="p">
			This embedded app template uses
			<Link href="https://shopify.dev/docs/apps/tools/app-bridge" external>App Bridge</Link>
			interface examples like an
			<Link href="/app/additional">additional page in the app nav</Link>, as well as an
			<Link href="https://shopify.dev/docs/api/admin-graphql" external>Admin GraphQL</Link>
			mutation demo, to provide a starting point for app development.
		</Text>
	</Card>

	<Card title="Get started with products">
		<div class="products-section">
			<Text as="p">
				Generate a product with GraphQL and get the JSON output for that product. Learn more about
				the
				<Link
					href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
					external
				>
					productCreate
				</Link>
				mutation in our API references.
			</Text>

			<div class="product-actions">
				<form method="POST" action="?/createProduct" use:enhance={handleSubmit}>
					<Button type="submit" loading={isLoading}>Generate a product</Button>
				</form>
				{#if form?.product}
					<Button variant="plain" onclick={editProduct}>Edit product</Button>
				{/if}
			</div>

			{#if form?.error}
				<Banner tone="critical" title="Error">
					{form.error}
				</Banner>
			{/if}

			{#if form?.product}
				<Card title="productCreate mutation" padding="none">
					<pre class="code-block"><code>{JSON.stringify(form.product, null, 2)}</code></pre>
				</Card>

				{#if form.variant}
					<Card title="productVariantsBulkUpdate mutation" padding="none">
						<pre class="code-block"><code>{JSON.stringify(form.variant, null, 2)}</code></pre>
					</Card>
				{/if}
			{/if}
		</div>
	</Card>
</Page>

<style>
	.specs-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-200);
	}

	.specs-list p {
		margin: 0;
	}

	.next-steps {
		margin: 0;
		padding-left: var(--space-500);
		display: flex;
		flex-direction: column;
		gap: var(--space-200);
	}

	.products-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-400);
	}

	.product-actions {
		display: flex;
		gap: var(--space-200);
		align-items: center;
	}

	.code-block {
		margin: 0;
		padding: var(--space-400);
		background: var(--color-bg-surface-secondary);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		overflow-x: auto;
		font-size: var(--font-size-sm);
	}

	.code-block code {
		font-family: 'SF Mono', Monaco, 'Andale Mono', monospace;
	}
</style>
