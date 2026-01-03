<svelte:head>
	<title>Shopify App</title>
	<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
	<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
</svelte:head>

<s-page>
	<s-section heading="Welcome to your Shopify App">
		<s-text>
			This app is designed to run embedded within the Shopify Admin.
		</s-text>
		<form method="POST" action="/auth/login">
			<s-stack gap="base">
				<s-text-field
					name="shop"
					label="Shop domain"
					details="e.g: my-shop-domain.myshopify.com"
				></s-text-field>
				<s-button type="submit">Log in</s-button>
			</s-stack>
		</form>
	</s-section>
</s-page>
