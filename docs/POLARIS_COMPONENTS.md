# Polaris Web Components Reference

This document covers the Shopify Polaris web components used in this template and patterns for building embedded Shopify apps.

## Table of Contents

- [Loading Polaris](#loading-polaris)
- [Page Patterns](#page-patterns)
- [Component Reference](#component-reference)
- [Custom Components](#custom-components)
- [Async Data Loading](#async-data-loading)
- [File Reference](#file-reference)

---

## Loading Polaris

Polaris web components are loaded in the app layout (`src/routes/app/+layout.svelte`):

```svelte
<svelte:head>
	<meta name="shopify-api-key" content={data.apiKey} />
	<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
	<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
</svelte:head>
```

---

## Page Patterns

### Index/List Page

Used for displaying collections of objects (products, orders, puzzles).

**Key features:**
- Search field with filters
- Table with checkboxes for bulk selection
- Empty state handling
- Skeleton loading

**Example:** `src/routes/app/products/+page.svelte`, `src/routes/app/puzzles/+page.svelte`

```svelte
<s-page heading="Products">
	<s-link slot="primary-action" href="shopify://admin/products/new">
		<s-button>Add product</s-button>
	</s-link>

	<s-section padding="none" accessibilityLabel="Products table section">
		<s-table>
			<s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
				<s-search-field
					label="Search products"
					labelAccessibilityVisibility="exclusive"
					placeholder="Search products"
				></s-search-field>
				<s-button icon="filter" variant="secondary" accessibilityLabel="Filter"></s-button>
			</s-grid>
			<s-table-header-row>
				<s-table-header listSlot="primary">Product</s-table-header>
				<s-table-header format="numeric">Price</s-table-header>
				<s-table-header listSlot="secondary">Status</s-table-header>
			</s-table-header-row>
			<s-table-body>
				{#each items as item}
					<s-table-row clickDelegate="item-{item.id}-checkbox">
						<s-table-cell>
							<s-stack direction="inline" gap="small" alignItems="center">
								<s-checkbox id="item-{item.id}-checkbox"></s-checkbox>
								<s-link href="/app/items/{item.id}">{item.name}</s-link>
							</s-stack>
						</s-table-cell>
						<s-table-cell>{item.price}</s-table-cell>
						<s-table-cell>
							<s-badge tone="success">Active</s-badge>
						</s-table-cell>
					</s-table-row>
				{/each}
			</s-table-body>
		</s-table>
	</s-section>
</s-page>
```

### Details Page

Used for viewing/editing a single object.

**Key features:**
- Breadcrumb navigation
- Form with `data-save-bar` for contextual save
- Aside slot for summary/preview
- Multiple sections

**Example:** `src/routes/app/puzzles/[id]/+page.svelte`

```svelte
<form data-save-bar onsubmit={handleSubmit} onreset={handleReset}>
	<s-page heading="Item Name" inlineSize="small" breadcrumb="/app/items">
		<s-button slot="primary-action" variant="primary" submit>Save</s-button>
		<s-button slot="secondary-actions" variant="secondary">Duplicate</s-button>
		<s-button slot="secondary-actions" variant="secondary" tone="critical">Delete</s-button>

		<s-section heading="Information">
			<s-text-field label="Name" name="name" value={item.name}></s-text-field>
			<s-text-field label="Description" name="description" multiline rows="3"></s-text-field>
		</s-section>

		<s-section heading="Settings">
			<s-select label="Size" name="size">
				<s-option value="small">Small</s-option>
				<s-option value="medium" selected>Medium</s-option>
			</s-select>
		</s-section>

		<!-- Aside slot for sidebar -->
		<s-box slot="aside">
			<s-section heading="Summary">
				<!-- Summary content -->
			</s-section>
		</s-box>
	</s-page>
</form>
```

### Settings Page

Used for app configuration.

**Key features:**
- Form with `data-save-bar`
- Choice lists for options
- Switches for toggles
- Clickable navigation items

**Example:** `src/routes/app/settings/+page.svelte`

```svelte
<form data-save-bar onsubmit={handleSubmit} onreset={handleReset}>
	<s-page heading="Settings" inlineSize="small">
		<s-section heading="Store Information">
			<s-text-field label="Store name" name="store-name" value="My Store"></s-text-field>
			<s-choice-list label="Currency" name="currency">
				<s-choice value="usd" selected>US Dollar ($)</s-choice>
				<s-choice value="eur">Euro</s-choice>
			</s-choice-list>
		</s-section>

		<s-section heading="Notifications">
			<s-choice-list label="Notification types" name="notifications" multiple>
				<s-choice value="orders" selected>New orders</s-choice>
				<s-choice value="stock">Low stock alerts</s-choice>
			</s-choice-list>
		</s-section>
	</s-page>
</form>
```

### Homepage

Used for app dashboard/landing page.

**Key features:**
- Dismissible banners
- Setup guide with progress
- Metric cards
- Callout cards

**Example:** `src/routes/app/+page.svelte`

---

## Component Reference

### Page Structure

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-page` | Main page container | `heading`, `inlineSize="small"`, `breadcrumb` |
| `s-section` | Content section | `heading`, `padding="none"` |
| `s-box` | Generic container | `padding`, `border`, `borderRadius`, `background` |
| `s-grid` | CSS Grid layout | `gridTemplateColumns`, `gap`, `alignItems` |
| `s-stack` | Flexbox layout | `direction="inline"`, `gap`, `alignItems` |

### Navigation

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-app-nav` | App navigation container | - |
| `s-link` | Navigation link | `href`, `rel="home"` |

```svelte
<s-app-nav>
	<s-link href="/app" rel="home">Home</s-link>
	<s-link href="/app/products">Products</s-link>
</s-app-nav>
```

### Tables

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-table` | Table container | - |
| `s-table-header-row` | Header row | - |
| `s-table-header` | Header cell | `listSlot="primary\|secondary"`, `format="numeric"` |
| `s-table-body` | Body container | - |
| `s-table-row` | Body row | `clickDelegate` (for checkbox click) |
| `s-table-cell` | Body cell | - |

**Table with filters slot:**

```svelte
<s-table>
	<s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
		<s-search-field ...></s-search-field>
		<s-button icon="filter" variant="secondary"></s-button>
	</s-grid>
	<!-- headers and body -->
</s-table>
```

**Row with checkbox selection:**

```svelte
<s-table-row clickDelegate="item-checkbox">
	<s-table-cell>
		<s-stack direction="inline" gap="small" alignItems="center">
			<s-checkbox id="item-checkbox"></s-checkbox>
			<s-link href="...">{name}</s-link>
		</s-stack>
	</s-table-cell>
</s-table-row>
```

### Forms

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-text-field` | Text input | `label`, `name`, `value`, `placeholder`, `multiline`, `rows` |
| `s-search-field` | Search input (auto clear button) | `label`, `labelAccessibilityVisibility="exclusive"`, `placeholder` |
| `s-select` | Dropdown select | `label`, `name` |
| `s-option` | Select option | `value`, `selected` |
| `s-choice-list` | Radio/checkbox group | `label`, `name`, `multiple` |
| `s-choice` | Choice option | `value`, `selected` |
| `s-checkbox` | Standalone checkbox | `id`, `checked` |
| `s-switch` | Toggle switch | `label`, `name`, `checked` |

**Form with contextual save bar:**

```svelte
<form data-save-bar onsubmit={handleSubmit} onreset={handleReset}>
	<!-- form content -->
</form>
```

### Buttons

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-button` | Button | `variant="primary\|secondary\|tertiary"`, `tone="critical"`, `icon`, `submit` |
| `s-button-group` | Button container | - |

**Button variants:**

```svelte
<s-button variant="primary">Primary</s-button>
<s-button variant="secondary">Secondary</s-button>
<s-button variant="tertiary" icon="x" tone="neutral"></s-button>
<s-button tone="critical">Delete</s-button>
```

### Feedback

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-badge` | Status badge | `tone="success\|neutral\|warning\|critical"`, `color="base"` |
| `s-banner` | Alert banner | `tone`, `heading`, `dismissible` |
| `s-spinner` | Loading spinner | `size="small\|large"`, `accessibilityLabel` |

### Media

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-image` | Image | `src`, `alt`, `objectFit="cover"`, `aspectRatio` |
| `s-icon` | Icon | `name`, `type` |
| `s-clickable` | Clickable container | `href`, `accessibilityLabel`, `border`, `borderRadius`, `overflow` |

### Other

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `s-divider` | Horizontal divider | - |
| `s-text` | Text with styling | `color="subdued"`, `fontWeight="semibold"` |
| `s-heading` | Heading text | - |
| `s-paragraph` | Paragraph text | - |

---

## Custom Components

### Skeleton (Loading Placeholder)

Location: `src/lib/components/Skeleton.svelte`

Used for skeleton loading animations while fetching data.

```svelte
<script>
	import Skeleton from '$lib/components/Skeleton.svelte';
</script>

<!-- Text placeholder -->
<Skeleton variant="text" width="120px" />

<!-- Box placeholder (image thumbnail) -->
<Skeleton variant="box" />
<Skeleton variant="box" width="100%" height="36px" />

<!-- Badge placeholder (pill shape) -->
<Skeleton variant="badge" />

<!-- Circle placeholder (avatar) -->
<Skeleton variant="circle" width="60px" height="60px" />
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'text' \| 'box' \| 'badge' \| 'circle'` | `'text'` | Shape variant |
| `width` | `string` | varies by variant | Custom width |
| `height` | `string` | varies by variant | Custom height |

**Default dimensions:**

| Variant | Width | Height | Border Radius |
|---------|-------|--------|---------------|
| `text` | 100px | 16px | 4px |
| `box` | 40px | 40px | 8px |
| `badge` | 60px | 24px | 12px (pill) |
| `circle` | 40px | 40px | 50% |

---

## Async Data Loading

### Pattern: Client-side fetch with session token

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	let items = $state([]);
	let isLoading = $state(true);
	let isSearching = $state(false);
	let searchQuery = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	async function fetchItems(query = '') {
		const token = await window.shopify.idToken();
		const url = query ? `/api/items?search=${encodeURIComponent(query)}` : '/api/items';
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` }
		});
		const data = await response.json();
		items = data.items || [];
	}

	onMount(async () => {
		await fetchItems();
		isLoading = false;
	});

	function handleSearch(event: Event) {
		searchQuery = (event.target as HTMLInputElement).value;

		if (searchTimeout) clearTimeout(searchTimeout);

		isSearching = true;
		searchTimeout = setTimeout(async () => {
			await fetchItems(searchQuery);
			isSearching = false;
		}, 300); // Debounce 300ms
	}
</script>

{#if isLoading}
	<!-- Skeleton table -->
	<s-table-body>
		{#each [1, 2, 3, 4, 5] as i}
			<s-table-row>
				<s-table-cell>
					<s-stack direction="inline" gap="small" alignItems="center">
						<Skeleton variant="box" />
						<Skeleton variant="text" width="120px" />
					</s-stack>
				</s-table-cell>
			</s-table-row>
		{/each}
	</s-table-body>
{:else if isSearching}
	<!-- Same skeleton while searching -->
{:else if items.length > 0}
	<!-- Actual content -->
{:else}
	<!-- Empty state -->
{/if}
```

### API Endpoint Pattern

```typescript
// src/routes/api/items/+server.ts
import { json, error } from '@sveltejs/kit';
import { shopify, getOfflineSessionId } from '$lib/server/shopify';
import { createAdmin } from '$lib/server/shopify/graphql';

export const GET: RequestHandler = async ({ request, url }) => {
	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		error(401, 'Unauthorized');
	}

	const token = authHeader.substring(7);
	const searchQuery = url.searchParams.get('search') || '';

	// Validate token and get session
	const payload = await shopify.api.session.decodeSessionToken(token);
	const shop = payload.dest.replace('https://', '');
	const sessionId = getOfflineSessionId(shop);
	const session = await shopify.sessionStorage.loadSession(sessionId);

	const admin = createAdmin(session);

	const response = await admin.graphql(
		`#graphql
		query GetItems($first: Int!, $query: String) {
			items(first: $first, query: $query) {
				edges {
					node {
						id
						title
					}
				}
			}
		}`,
		{ variables: { first: 25, query: searchQuery || null } }
	);

	return json({ items: response.data.items.edges.map(e => e.node) });
};
```

---

## File Reference

| File | Description |
|------|-------------|
| `src/routes/app/+layout.svelte` | App layout with navigation |
| `src/routes/app/+page.svelte` | Homepage with setup guide |
| `src/routes/app/products/+page.svelte` | Products index with search |
| `src/routes/app/puzzles/+page.svelte` | Puzzles index page |
| `src/routes/app/puzzles/[id]/+page.svelte` | Puzzle details page |
| `src/routes/app/settings/+page.svelte` | Settings page |
| `src/routes/app/template-info/+page.svelte` | Template info page |
| `src/routes/api/products/+server.ts` | Products API with search |
| `src/lib/components/Skeleton.svelte` | Skeleton loading component |
