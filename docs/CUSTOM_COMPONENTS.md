# Custom Components

Reusable Svelte components built for this template. Located in `src/lib/components/`.

This project uses custom Svelte components styled to match Shopify admin aesthetics.

## App Bridge Web Components

The following App Bridge web components are available (loaded via `app-bridge.js`):

| Component       | Description                                       |
| --------------- | ------------------------------------------------- |
| `s-app-nav`     | App navigation menu                               |
| `s-link`        | Navigation links within app-nav                   |
| `s-app-window`  | Fullscreen modal windows                          |
| `data-save-bar` | Form attribute for automatic save bar integration |

For all other UI needs, use the custom Svelte components documented below.

---

## Component Reference

### Layout Components

#### Page

Main page container with header, actions, and optional aside layout.

```svelte
<script>
	import { Page, Button } from '$lib/components';
</script>

<Page
	title="Page Title"
	subtitle="Optional subtitle"
	narrow
	backAction={{ url: '/app/parent', label: 'Parent' }}
>
	{#snippet primaryAction()}
		<Button variant="primary">Save</Button>
	{/snippet}

	{#snippet secondaryActions()}
		<Button>Cancel</Button>
	{/snippet}

	{#snippet aside()}
		<!-- Sidebar content -->
	{/snippet}

	<!-- Main content -->
</Page>
```

**Props:**

| Prop               | Type                              | Default | Description                |
| ------------------ | --------------------------------- | ------- | -------------------------- |
| `title`            | `string`                          | -       | Page heading               |
| `subtitle`         | `string`                          | -       | Optional subheading        |
| `narrow`           | `boolean`                         | `false` | Use narrower max-width     |
| `backAction`       | `{ url: string, label?: string }` | -       | Back navigation link       |
| `primaryAction`    | `Snippet`                         | -       | Primary action button slot |
| `secondaryActions` | `Snippet`                         | -       | Secondary actions slot     |
| `aside`            | `Snippet`                         | -       | Sidebar content slot       |

#### Card

Content container with optional title, subtitle, and actions.

```svelte
<script>
	import { Card, Button } from '$lib/components';
</script>

<Card title="Card Title" subtitle="Optional subtitle" padding="base">
	{#snippet actions()}
		<Button variant="tertiary" iconOnly>...</Button>
	{/snippet}

	<!-- Card content -->
</Card>
```

**Props:**

| Prop       | Type                                     | Default  | Description         |
| ---------- | ---------------------------------------- | -------- | ------------------- |
| `title`    | `string`                                 | -        | Card heading        |
| `subtitle` | `string`                                 | -        | Optional subheading |
| `padding`  | `'none' \| 'tight' \| 'base' \| 'loose'` | `'base'` | Body padding        |
| `actions`  | `Snippet`                                | -        | Header actions slot |
| `footer`   | `Snippet`                                | -        | Footer content slot |

---

### Form Components

#### Button

Versatile button component supporting multiple variants and states.

```svelte
<script>
	import { Button, Icon } from '$lib/components';
</script>

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="tertiary">Tertiary</Button>
<Button variant="plain">Plain link</Button>

<Button tone="critical">Delete</Button>
<Button tone="success">Confirm</Button>

<Button size="slim">Small</Button>
<Button size="large">Large</Button>

<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>

<Button iconOnly>
	{#snippet icon()}<Icon name="x" />{/snippet}
</Button>

<Button href="/path">Link Button</Button>
```

**Props:**

| Prop        | Type                                                | Default       | Description          |
| ----------- | --------------------------------------------------- | ------------- | -------------------- |
| `variant`   | `'primary' \| 'secondary' \| 'tertiary' \| 'plain'` | `'secondary'` | Visual style         |
| `tone`      | `'default' \| 'critical' \| 'success'`              | `'default'`   | Color tone           |
| `size`      | `'slim' \| 'medium' \| 'large'`                     | `'medium'`    | Button size          |
| `fullWidth` | `boolean`                                           | `false`       | Full width button    |
| `loading`   | `boolean`                                           | `false`       | Show loading spinner |
| `disabled`  | `boolean`                                           | `false`       | Disable button       |
| `iconOnly`  | `boolean`                                           | `false`       | Icon-only button     |
| `icon`      | `Snippet`                                           | -             | Icon slot            |
| `href`      | `string`                                            | -             | Render as link       |
| `type`      | `'button' \| 'submit' \| 'reset'`                   | `'button'`    | Button type          |

#### TextField

Text input with label, validation, and prefix/suffix support.

```svelte
<script>
	import { TextField } from '$lib/components';
</script>

<TextField
	label="Name"
	name="name"
	value="John"
	placeholder="Enter name"
	helpText="Your full name"
/>

<TextField label="Price" name="price" type="number" prefix="$" />

<TextField label="Description" name="desc" multiline rows={3} />
```

**Props:**

| Prop          | Type                | Default  | Description         |
| ------------- | ------------------- | -------- | ------------------- |
| `label`       | `string`            | -        | Input label         |
| `name`        | `string`            | -        | Input name          |
| `value`       | `string`            | `''`     | Input value         |
| `type`        | `string`            | `'text'` | Input type          |
| `placeholder` | `string`            | -        | Placeholder text    |
| `disabled`    | `boolean`           | `false`  | Disable input       |
| `error`       | `string`            | -        | Error message       |
| `helpText`    | `string`            | -        | Help text           |
| `prefix`      | `string \| Snippet` | -        | Input prefix        |
| `suffix`      | `string \| Snippet` | -        | Input suffix        |
| `multiline`   | `boolean`           | `false`  | Textarea mode       |
| `rows`        | `number`            | `3`      | Textarea rows       |
| `labelHidden` | `boolean`           | `false`  | Hide label visually |

#### Select

Dropdown select input.

```svelte
<script>
	import { Select } from '$lib/components';

	const options = [
		{ value: 'small', label: 'Small' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'large', label: 'Large' }
	];
</script>

<Select label="Size" name="size" {options} value="medium" />
```

**Props:**

| Prop          | Type                                 | Default              | Description    |
| ------------- | ------------------------------------ | -------------------- | -------------- |
| `label`       | `string`                             | -                    | Select label   |
| `name`        | `string`                             | -                    | Select name    |
| `options`     | `{ value: string, label: string }[]` | -                    | Options array  |
| `value`       | `string`                             | `''`                 | Selected value |
| `placeholder` | `string`                             | `'Select an option'` | Placeholder    |
| `disabled`    | `boolean`                            | `false`              | Disable select |
| `error`       | `string`                             | -                    | Error message  |
| `helpText`    | `string`                             | -                    | Help text      |

#### Checkbox

Checkbox input with label and help text.

```svelte
<script>
	import { Checkbox } from '$lib/components';
</script>

<Checkbox label="Enable feature" name="feature" checked />
<Checkbox label="Accept terms" name="terms" helpText="Required" />
```

**Props:**

| Prop       | Type      | Default | Description      |
| ---------- | --------- | ------- | ---------------- |
| `label`    | `string`  | -       | Checkbox label   |
| `name`     | `string`  | -       | Checkbox name    |
| `checked`  | `boolean` | `false` | Checked state    |
| `value`    | `string`  | `''`    | Checkbox value   |
| `disabled` | `boolean` | `false` | Disable checkbox |
| `helpText` | `string`  | -       | Help text        |
| `error`    | `string`  | -       | Error message    |

#### Switch

Toggle switch for boolean settings.

```svelte
<script>
	import { Switch } from '$lib/components';
</script>

<Switch
	label="Enable notifications"
	name="notifications"
	helpText="Receive email notifications"
	checked
/>
```

**Props:**

| Prop       | Type      | Default | Description    |
| ---------- | --------- | ------- | -------------- |
| `label`    | `string`  | -       | Switch label   |
| `name`     | `string`  | -       | Switch name    |
| `checked`  | `boolean` | `false` | Checked state  |
| `disabled` | `boolean` | `false` | Disable switch |
| `helpText` | `string`  | -       | Help text      |

#### SearchField

Search input with clear button.

```svelte
<script>
	import { SearchField } from '$lib/components';

	let query = $state('');
</script>

<SearchField
	placeholder="Search products"
	value={query}
	oninput={(e) => (query = e.target.value)}
	onclear={() => (query = '')}
/>
```

---

### Data Display Components

#### DataTable

Table component with styling and responsive support.

```svelte
<script>
	import { DataTable, Badge } from '$lib/components';
</script>

<DataTable>
	<thead>
		<tr>
			<th>Product</th>
			<th data-align="right">Price</th>
			<th>Status</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>
				<div class="cell-content">
					<img src="..." alt="..." class="thumbnail" />
					Product Name
				</div>
			</td>
			<td data-align="right">$19.99</td>
			<td><Badge tone="success">Active</Badge></td>
		</tr>
	</tbody>
</DataTable>
```

**Props:**

| Prop        | Type      | Default | Description             |
| ----------- | --------- | ------- | ----------------------- |
| `hoverable` | `boolean` | `true`  | Highlight rows on hover |
| `striped`   | `boolean` | `false` | Alternating row colors  |

#### Badge

Status badge component.

```svelte
<script>
	import { Badge } from '$lib/components';
</script>

<Badge>Default</Badge>
<Badge tone="success">Active</Badge>
<Badge tone="info">Info</Badge>
<Badge tone="caution">Caution</Badge>
<Badge tone="warning">Warning</Badge>
<Badge tone="critical">Error</Badge>
<Badge size="small">Small</Badge>
```

**Props:**

| Prop   | Type                                                                       | Default     | Description |
| ------ | -------------------------------------------------------------------------- | ----------- | ----------- |
| `tone` | `'default' \| 'success' \| 'info' \| 'caution' \| 'warning' \| 'critical'` | `'default'` | Color tone  |
| `size` | `'small' \| 'medium'`                                                      | `'medium'`  | Badge size  |

#### Banner

Alert/notification banner.

```svelte
<script>
	import { Banner } from '$lib/components';

	let visible = $state(true);
</script>

{#if visible}
	<Banner title="Important notice" tone="info" dismissible ondismiss={() => (visible = false)}>
		This is a notification message.
	</Banner>
{/if}
```

**Props:**

| Prop          | Type                                                          | Default     | Description         |
| ------------- | ------------------------------------------------------------- | ----------- | ------------------- |
| `title`       | `string`                                                      | -           | Banner heading      |
| `tone`        | `'default' \| 'success' \| 'warning' \| 'critical' \| 'info'` | `'default'` | Color tone          |
| `dismissible` | `boolean`                                                     | `false`     | Show dismiss button |
| `ondismiss`   | `() => void`                                                  | -           | Dismiss callback    |
| `actions`     | `Snippet`                                                     | -           | Action buttons slot |

#### Spinner

Loading spinner.

```svelte
<script>
	import { Spinner } from '$lib/components';
</script>

<Spinner size="small" />
<Spinner size="medium" />
<Spinner size="large" label="Loading data..." />
```

**Props:**

| Prop    | Type                             | Default     | Description         |
| ------- | -------------------------------- | ----------- | ------------------- |
| `size`  | `'small' \| 'medium' \| 'large'` | `'medium'`  | Spinner size        |
| `label` | `string`                         | `'Loading'` | Accessibility label |

#### Skeleton

Loading placeholder with shimmer animation.

```svelte
<script>
	import { Skeleton } from '$lib/components';
</script>

<Skeleton variant="text" width="120px" />
<Skeleton variant="box" />
<Skeleton variant="badge" />
<Skeleton variant="circle" width="40px" height="40px" />
```

**Props:**

| Prop      | Type                                     | Default  | Description   |
| --------- | ---------------------------------------- | -------- | ------------- |
| `variant` | `'text' \| 'box' \| 'badge' \| 'circle'` | `'text'` | Shape variant |
| `width`   | `string`                                 | varies   | Custom width  |
| `height`  | `string`                                 | varies   | Custom height |

---

### Typography Components

#### Text

Text component with variant and tone support.

```svelte
<script>
	import { Text } from '$lib/components';
</script>

<Text variant="headingLg">Large Heading</Text>
<Text variant="headingMd">Medium Heading</Text>
<Text variant="bodySm" tone="subdued">Small subdued text</Text>
<Text as="p">Paragraph text</Text>
<Text fontWeight="semibold">Bold text</Text>
```

**Props:**

| Prop         | Type                                                                                                          | Default     | Description            |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------- |
| `as`         | `'span' \| 'p' \| 'div' \| 'label'`                                                                           | `'span'`    | HTML element           |
| `variant`    | `'bodyMd' \| 'bodySm' \| 'bodyLg' \| 'headingXs' \| 'headingSm' \| 'headingMd' \| 'headingLg' \| 'headingXl'` | `'bodyMd'`  | Text variant           |
| `tone`       | `'default' \| 'subdued' \| 'success' \| 'critical' \| 'warning'`                                              | `'default'` | Color tone             |
| `fontWeight` | `'regular' \| 'medium' \| 'semibold' \| 'bold'`                                                               | -           | Font weight override   |
| `alignment`  | `'start' \| 'center' \| 'end'`                                                                                | -           | Text alignment         |
| `truncate`   | `boolean`                                                                                                     | `false`     | Truncate with ellipsis |

#### Link

Styled link component.

```svelte
<script>
	import { Link } from '$lib/components';
</script>

<Link href="/app/page">Internal link</Link>
<Link href="https://example.com" external>External link</Link>
<Link href="/app" monochrome>Monochrome link</Link>
```

**Props:**

| Prop         | Type      | Default | Description        |
| ------------ | --------- | ------- | ------------------ |
| `href`       | `string`  | -       | Link URL           |
| `external`   | `boolean` | `false` | Open in new tab    |
| `monochrome` | `boolean` | `false` | Inherit text color |

#### Divider

Horizontal divider line.

```svelte
<script>
	import { Divider } from '$lib/components';
</script>

<Divider spacing="none" />
<Divider spacing="tight" />
<Divider spacing="base" />
<Divider spacing="loose" />
```

**Props:**

| Prop      | Type                                     | Default  | Description     |
| --------- | ---------------------------------------- | -------- | --------------- |
| `spacing` | `'none' \| 'tight' \| 'base' \| 'loose'` | `'base'` | Vertical margin |

#### Icon

SVG icon component.

```svelte
<script>
	import { Icon } from '$lib/components';
</script>

<Icon name="chevron-down" />
<Icon name="x" size="small" />
<Icon name="check" tone="success" />
```

**Available icons:** `chevron-down`, `chevron-up`, `chevron-left`, `chevron-right`, `x`, `search`, `filter`, `plus`, `minus`, `check`, `arrow-up`, `arrow-down`, `external`, `image`, `download`, `edit`, `delete`, `more`

**Props:**

| Prop   | Type                                                             | Default     | Description |
| ------ | ---------------------------------------------------------------- | ----------- | ----------- |
| `name` | `string`                                                         | -           | Icon name   |
| `size` | `'small' \| 'medium' \| 'large'`                                 | `'medium'`  | Icon size   |
| `tone` | `'default' \| 'subdued' \| 'success' \| 'critical' \| 'warning'` | `'default'` | Color tone  |

#### EmptyState

Empty state placeholder with image and actions.

```svelte
<script>
	import { EmptyState, Button } from '$lib/components';
</script>

<EmptyState
	heading="No products yet"
	description="Add your first product to get started"
	image="/images/empty.svg"
>
	<Button variant="primary">Add product</Button>
</EmptyState>
```

**Props:**

| Prop          | Type     | Default | Description            |
| ------------- | -------- | ------- | ---------------------- |
| `heading`     | `string` | -       | Empty state title      |
| `description` | `string` | -       | Description text       |
| `image`       | `string` | -       | Illustration image URL |
| `imageAlt`    | `string` | `''`    | Image alt text         |

---

## CSS Variables (Polaris Design Tokens)

The component library uses CSS custom properties defined in `src/lib/styles/shopify.css`, based on Shopify's Polaris design tokens.

### Background Colors

- `--color-bg` - Page background
- `--color-bg-surface` - Card/surface background
- `--color-bg-surface-hover`, `--color-bg-surface-active`, `--color-bg-surface-selected`
- `--color-bg-surface-secondary`, `--color-bg-surface-tertiary`
- `--color-bg-surface-success`, `--color-bg-surface-info`, `--color-bg-surface-caution`, `--color-bg-surface-warning`, `--color-bg-surface-critical`

### Fill Colors

- `--color-bg-fill` - Primary fill (white)
- `--color-bg-fill-brand`, `--color-bg-fill-brand-hover` - Brand fills (dark)
- `--color-bg-fill-success`, `--color-bg-fill-critical`, `--color-bg-fill-warning`, `--color-bg-fill-info`, `--color-bg-fill-caution`

### Text Colors

- `--color-text` - Primary text
- `--color-text-secondary` - Subdued text
- `--color-text-disabled`, `--color-text-inverse`
- `--color-text-success`, `--color-text-critical`, `--color-text-warning`, `--color-text-caution`, `--color-text-info`
- `--color-text-link`, `--color-text-link-hover`

### Border Colors

- `--color-border` - Default border
- `--color-border-hover`, `--color-border-focus`, `--color-border-disabled`
- `--color-border-success`, `--color-border-critical`, `--color-border-warning`, `--color-border-caution`, `--color-border-info`

### Icon Colors

- `--color-icon`, `--color-icon-hover`, `--color-icon-secondary`, `--color-icon-disabled`
- `--color-icon-success`, `--color-icon-critical`, `--color-icon-warning`, `--color-icon-caution`, `--color-icon-info`

### Spacing Scale

- `--space-0` (0) through `--space-3200` (8rem)
- Common: `--space-100` (0.25rem), `--space-200` (0.5rem), `--space-300` (0.75rem), `--space-400` (1rem), `--space-600` (1.5rem)

### Typography

- **Font sizes**: `--font-size-275` (0.6875rem) through `--font-size-1000` (2.5rem)
- **Aliases**: `--font-size-xs`, `--font-size-sm`, `--font-size-md`, `--font-size-lg`, `--font-size-xl`, `--font-size-2xl`
- **Weights**: `--font-weight-regular` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700)
- **Line heights**: `--line-height-300` through `--line-height-1200`, plus `--line-height-tight`, `--line-height-normal`

### Border Radius

- `--radius-0` through `--radius-full` (pill)
- Aliases: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`

### Shadows

- `--shadow-100` through `--shadow-600`
- `--shadow-card` (alias for `--shadow-200`)
- `--shadow-button`, `--shadow-button-primary`, `--shadow-button-primary-hover`
- Aliases: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`

### Motion

- **Durations**: `--duration-50` through `--duration-500`
- **Aliases**: `--duration-fast` (100ms), `--duration-base` (200ms), `--duration-slow` (300ms)
- **Easing**: `--ease`, `--ease-in`, `--ease-out`, `--ease-in-out`, `--ease-linear`

### Z-Index

- `--z-index-1` through `--z-index-5`
- Aliases: `--z-sticky`, `--z-modal`, `--z-toast`

---

## Importing Components

Import components from the index file:

```svelte
<script>
	import { Page, Card, Button, TextField, Badge, Text } from '$lib/components';
</script>
```

Or import individual components:

```svelte
<script>
	import Button from '$lib/components/Button.svelte';
</script>
```
