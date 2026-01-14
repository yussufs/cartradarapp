<script lang="ts">
	import { onMount } from 'svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface Product {
		id: string;
		title: string;
		status: string;
		createdAt: string;
		image: string | null;
		imageAlt: string;
		price: string;
		inventory: number | null;
	}

	let products = $state<Product[]>([]);
	let isLoading = $state(true);
	let isSearching = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	async function fetchProducts(query: string = '') {
		try {
			if (!window.shopify) {
				throw new Error('Shopify App Bridge not loaded');
			}

			const token = await window.shopify.idToken();
			const url = query ? `/api/products?search=${encodeURIComponent(query)}` : '/api/products';
			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch products');
			}

			const data = await response.json();
			products = data.products || [];
			if (data.error) {
				error = data.error;
			} else {
				error = null;
			}
		} catch (err) {
			console.error('Error fetching products:', err);
			error = 'Failed to load products';
		}
	}

	onMount(async () => {
		await fetchProducts();
		isLoading = false;
	});

	function handleSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		searchQuery = input.value;

		// Debounce search
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		isSearching = true;
		searchTimeout = setTimeout(async () => {
			await fetchProducts(searchQuery);
			isSearching = false;
		}, 300);
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
		});
	}

	function getStatusTone(status: string): string {
		switch (status) {
			case 'ACTIVE':
				return 'success';
			case 'DRAFT':
				return 'neutral';
			case 'ARCHIVED':
				return 'warning';
			default:
				return 'neutral';
		}
	}

	function formatStatus(status: string): string {
		return status.charAt(0) + status.slice(1).toLowerCase();
	}

	function formatPrice(price: string): string {
		return `$${parseFloat(price).toFixed(2)}`;
	}

	function getProductAdminUrl(id: string): string {
		const numericId = id.replace('gid://shopify/Product/', '');
		return `shopify://admin/products/${numericId}`;
	}
</script>

<svelte:head>
	<title>Products</title>
</svelte:head>

<s-page heading="Products">
	<s-link slot="primary-action" href="shopify://admin/products/new">
		<s-button>Add product</s-button>
	</s-link>

	{#if error}
		<s-banner tone="critical" heading="Error loading products">
			{error}
		</s-banner>
	{/if}

	{#if isLoading}
		<s-section padding="none" accessibilityLabel="Loading products">
			<s-table>
				<s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
					<Skeleton variant="box" width="100%" height="36px" />
					<Skeleton variant="box" width="36px" height="36px" />
				</s-grid>
				<s-table-header-row>
					<s-table-header listSlot="primary">Product</s-table-header>
					<s-table-header format="numeric">Price</s-table-header>
					<s-table-header format="numeric">Inventory</s-table-header>
					<s-table-header>Created</s-table-header>
					<s-table-header listSlot="secondary">Status</s-table-header>
				</s-table-header-row>
				<s-table-body>
					{#each [1, 2, 3, 4, 5] as i}
						<s-table-row>
							<s-table-cell>
								<s-stack direction="inline" gap="small" alignItems="center">
									<Skeleton variant="box" />
									<Skeleton variant="text" width="120px" />
								</s-stack>
							</s-table-cell>
							<s-table-cell>
								<Skeleton variant="text" width="60px" />
							</s-table-cell>
							<s-table-cell>
								<Skeleton variant="text" width="80px" />
							</s-table-cell>
							<s-table-cell>
								<Skeleton variant="text" width="70px" />
							</s-table-cell>
							<s-table-cell>
								<Skeleton variant="badge" />
							</s-table-cell>
						</s-table-row>
					{/each}
				</s-table-body>
			</s-table>
		</s-section>
	{:else}
		<s-section padding="none" accessibilityLabel="Products table section">
			<s-table>
				<s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
					<s-search-field
						label="Search products"
						labelAccessibilityVisibility="exclusive"
						placeholder="Search products"
						value={searchQuery}
						oninput={handleSearch}
					></s-search-field>
					<s-button
						icon="filter"
						variant="secondary"
						accessibilityLabel="Filter"
					></s-button>
				</s-grid>
				<s-table-header-row>
					<s-table-header listSlot="primary">Product</s-table-header>
					<s-table-header format="numeric">Price</s-table-header>
					<s-table-header format="numeric">Inventory</s-table-header>
					<s-table-header>Created</s-table-header>
					<s-table-header listSlot="secondary">Status</s-table-header>
				</s-table-header-row>
				{#if isSearching}
					<s-table-body>
						{#each [1, 2, 3, 4, 5] as i}
							<s-table-row>
								<s-table-cell>
									<s-stack direction="inline" gap="small" alignItems="center">
										<Skeleton variant="box" />
										<Skeleton variant="text" width="120px" />
									</s-stack>
								</s-table-cell>
								<s-table-cell>
									<Skeleton variant="text" width="60px" />
								</s-table-cell>
								<s-table-cell>
									<Skeleton variant="text" width="80px" />
								</s-table-cell>
								<s-table-cell>
									<Skeleton variant="text" width="70px" />
								</s-table-cell>
								<s-table-cell>
									<Skeleton variant="badge" />
								</s-table-cell>
							</s-table-row>
						{/each}
					</s-table-body>
				{:else if products.length > 0}
					<s-table-body>
						{#each products as product (product.id)}
							<s-table-row>
								<s-table-cell>
									<s-stack direction="inline" gap="small" alignItems="center">
										<s-clickable
											href={getProductAdminUrl(product.id)}
											accessibilityLabel="{product.title} thumbnail"
											border="base"
											borderRadius="base"
											overflow="hidden"
											inlineSize="40px"
											blockSize="40px"
										>
											{#if product.image}
												<s-image objectFit="cover" src={product.image}></s-image>
											{:else}
												<s-box
													background="subdued"
													inlineSize="40px"
													blockSize="40px"
													padding="small"
												>
													<s-icon name="image"></s-icon>
												</s-box>
											{/if}
										</s-clickable>
										<s-link href={getProductAdminUrl(product.id)}>{product.title}</s-link>
									</s-stack>
								</s-table-cell>
								<s-table-cell>{formatPrice(product.price)}</s-table-cell>
								<s-table-cell>
									{#if product.inventory !== null}
										{product.inventory} in stock
									{:else}
										<s-text tone="subdued">Not tracked</s-text>
									{/if}
								</s-table-cell>
								<s-table-cell>{formatDate(product.createdAt)}</s-table-cell>
								<s-table-cell>
									<s-badge color="base" tone={getStatusTone(product.status)}>
										{formatStatus(product.status)}
									</s-badge>
								</s-table-cell>
							</s-table-row>
						{/each}
					</s-table-body>
				{:else if searchQuery}
					<s-box padding="large-400">
						<s-stack alignItems="center" gap="small">
							<s-text color="subdued">No products found matching "{searchQuery}"</s-text>
						</s-stack>
					</s-box>
				{:else}
					<s-box padding="large-400">
						<s-stack alignItems="center" gap="base">
							<s-text color="subdued">No products yet</s-text>
							<s-link href="shopify://admin/products/new">
								<s-button>Add product</s-button>
							</s-link>
						</s-stack>
					</s-box>
				{/if}
			</s-table>
		</s-section>
	{/if}
</s-page>
