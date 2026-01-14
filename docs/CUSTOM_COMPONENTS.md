# Custom Components

Reusable Svelte components built for this template. Located in `src/lib/components/`.

---

## Skeleton

**File:** `src/lib/components/Skeleton.svelte`

Animated loading placeholder with shimmer effect. Use for skeleton loading states while fetching data.

### Usage

```svelte
<script>
	import Skeleton from '$lib/components/Skeleton.svelte';
</script>

<!-- Text placeholder -->
<Skeleton variant="text" />
<Skeleton variant="text" width="120px" />

<!-- Box placeholder (image thumbnail) -->
<Skeleton variant="box" />
<Skeleton variant="box" width="100%" height="36px" />

<!-- Badge placeholder (pill shape) -->
<Skeleton variant="badge" />

<!-- Circle placeholder (avatar) -->
<Skeleton variant="circle" />
<Skeleton variant="circle" width="60px" height="60px" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'text' \| 'box' \| 'badge' \| 'circle'` | `'text'` | Shape variant |
| `width` | `string` | varies | Custom width (CSS value) |
| `height` | `string` | varies | Custom height (CSS value) |

### Variant Defaults

| Variant | Width | Height | Border Radius |
|---------|-------|--------|---------------|
| `text` | 100px | 16px | 4px |
| `box` | 40px | 40px | 8px |
| `badge` | 60px | 24px | 12px (pill) |
| `circle` | 40px | 40px | 50% |

### Example: Table Loading State

```svelte
<script>
	import Skeleton from '$lib/components/Skeleton.svelte';

	let isLoading = $state(true);
</script>

{#if isLoading}
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
					<Skeleton variant="badge" />
				</s-table-cell>
			</s-table-row>
		{/each}
	</s-table-body>
{:else}
	<!-- Actual content -->
{/if}
```

### Styling

The component uses a CSS shimmer animation:
- Background: `#e4e5e7` to `#f0f1f2` gradient
- Animation: 1.5s ease-in-out infinite
- Direction: Right to left

---

## Adding New Components

When creating new reusable components:

1. Create the component in `src/lib/components/`
2. Export props interface with TypeScript
3. Add documentation to this file with:
   - File location
   - Usage examples
   - Props table
   - Common patterns
