# SvelteKit Shopify App Template

This is a SvelteKit template for building embedded Shopify apps.

## Project Overview

- **Framework**: SvelteKit 2 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **API**: Shopify Admin GraphQL API
- **Authentication**: Shopify OAuth with session tokens
- **UI**: Polaris Web Components (see [docs/POLARIS_COMPONENTS.md](docs/POLARIS_COMPONENTS.md))

## Key Directories

```
src/lib/server/shopify/   - Shopify API client and auth helpers
src/lib/server/db/        - Database schema and connection
src/lib/types/            - Generated GraphQL types
src/routes/app/           - Protected app pages (require auth)
src/routes/auth/          - OAuth flow handlers
src/routes/webhooks/      - Shopify webhook handlers
```

## Important Files

- `hooks.server.ts` - Authentication middleware
- `shopify.app.toml` - Shopify app configuration
- `drizzle.config.ts` - Database configuration
- `.graphqlrc.ts` - GraphQL codegen configuration

## Common Commands

```bash
pnpm run dev              # Start dev server
pnpm run db:push          # Push database schema
pnpm run graphql-codegen  # Generate GraphQL types
shopify app dev           # Start with Shopify CLI (recommended)
```

## MCP Servers

The following MCP servers are configured for documentation lookup and development assistance:

### Svelte MCP
Official Svelte MCP server for Svelte 5 and SvelteKit documentation:
- **list-sections**: Discover available documentation sections. Use FIRST when asked about Svelte/SvelteKit topics.
- **get-documentation**: Retrieve full documentation for specific sections.
- **svelte-autofixer**: Analyze Svelte code for issues. Use when writing Svelte components.
- **playground-link**: Generate Svelte Playground links (only when requested by user).

### Shopify Dev MCP
Official Shopify MCP server for Shopify development:
- **learn_shopify_api**: Initialize context for a specific Shopify API (Admin, Storefront, Functions, Polaris, Liquid, etc.)
- **search_docs_chunks**: Search Shopify developer documentation
- **fetch_full_docs**: Retrieve full documentation pages from shopify.dev
- **introspect_graphql_schema**: Explore Shopify GraphQL schemas
- **validate_graphql_codeblocks**: Validate GraphQL queries against Shopify schemas
- **validate_component_codeblocks**: Validate Polaris component usage

### Context7 MCP
Up-to-date documentation for any library:
- **resolve-library-id**: Find the Context7 library ID for a package
- **query-docs**: Retrieve documentation and code examples for any library

### Browser MCP
Browser automation for testing and debugging:
- **browser_navigate**, **browser_snapshot**, **browser_click**, etc.

## Shopify Questions

Always use the `/shopify` skill for ANY question about:
- Shopify APIs (Admin, Storefront, Partner, etc.)
- GraphQL queries/mutations for Shopify
- Polaris components
- Liquid themes
- Shopify Functions
- Shopify app development patterns

Invoke the skill immediately as the first action - do not use Shopify MCP tools directly without going through the skill.

## GraphQL Pattern

Use the `#graphql` tag for type generation:

```typescript
const response = await admin.graphql(
  `#graphql
    query GetShop {
      shop { name }
    }
  `
);
```

After adding new queries, run `pnpm run graphql-codegen`.

## Data Loading Pattern

**Never load GraphQL data directly in `+page.server.ts` load functions.** This blocks page rendering and hurts performance.

Instead, use the async client-side pattern:

### 1. Page Server Load (`+page.server.ts`)
Return minimal data - just validate auth and pass essential info:

```typescript
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.shopify) {
		error(401, 'Not authenticated');
	}
	// Return minimal data - fetch heavy data client-side
	return { shop: locals.shopify.session.shop };
};
```

### 2. API Endpoint (`/api/[resource]/+server.ts`)
Put GraphQL queries in API endpoints:

```typescript
export const GET: RequestHandler = async ({ request }) => {
	// Authenticate via session token
	const authHeader = request.headers.get('authorization');
	const token = authHeader?.substring(7);
	// ... validate token and get session ...

	const admin = createAdmin(session);
	const response = await admin.graphql(`#graphql query { ... }`);
	return json({ data: response.data });
};
```

### 3. Svelte Page (`+page.svelte`)
Fetch data client-side with loading states:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';

	let data = $state([]);
	let isLoading = $state(true);

	onMount(async () => {
		const token = await window.shopify.idToken();
		const response = await fetch('/api/resource', {
			headers: { Authorization: `Bearer ${token}` }
		});
		data = await response.json();
		isLoading = false;
	});
</script>
```

### Benefits
- **Faster initial page load**: Page renders immediately with loading state
- **Better UX**: Users see the page structure while data loads
- **Reusable endpoints**: API routes can be used by multiple pages
- **Proper auth**: Uses App Bridge session tokens for authenticated requests

See `src/routes/app/products/` and `src/routes/api/products/` for a complete example.

## Authentication Flow

1. Protected routes are under `/app/*`
2. `hooks.server.ts` validates session tokens from Authorization header
3. Valid sessions get `locals.shopify.admin` GraphQL client
4. Invalid sessions redirect to OAuth at `/auth`

## Polaris Web Components

For building UI, use Shopify's Polaris web components (`s-` prefixed). Full documentation: [docs/POLARIS_COMPONENTS.md](docs/POLARIS_COMPONENTS.md)

**Key patterns:**
- **Index pages**: `s-page` + `s-table` with `s-search-field` in filters slot
- **Details pages**: `s-page` with `breadcrumb` + `data-save-bar` form + `slot="aside"`
- **Settings pages**: `s-page` + `s-section` + `s-choice-list` / `s-switch`

## Custom Components

Reusable Svelte components in `src/lib/components/`. Full documentation: [docs/CUSTOM_COMPONENTS.md](docs/CUSTOM_COMPONENTS.md)

| Component | Description |
|-----------|-------------|
| `Skeleton` | Loading placeholder with shimmer animation |

## Code Style (Prettier)

Follow these formatting conventions when generating code:

- **Indentation**: Use tabs (not spaces)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Trailing commas**: None
- **Print width**: 100 characters
- **Svelte**: Uses `prettier-plugin-svelte` for `.svelte` files

Run `pnpm run format` to auto-format, or `pnpm run lint` to check formatting.
