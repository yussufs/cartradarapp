# SvelteKit Shopify App Template

This is a SvelteKit template for building embedded Shopify apps.

## Project Overview

- **Framework**: SvelteKit 2 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **API**: Shopify Admin GraphQL API
- **Authentication**: Shopify OAuth with session tokens
- **UI**: Custom Svelte components with App Bridge web components (see [docs/CUSTOM_COMPONENTS.md](docs/CUSTOM_COMPONENTS.md))

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
pnpm run dev:tunnel       # Start with the stable Cloudflare named tunnel
```

## Local Dev Gotcha: Cloudflare caches the dev tunnel's JS

`pnpm run dev:tunnel` serves the app through a Cloudflare-proxied `*-dev.dragonapps.io`
hostname. Cloudflare applies a **4-hour Browser Cache TTL to every `.js`** by default —
including SvelteKit's `.svelte-kit/generated/client/app.js` route manifest, whose URL is
stable but whose contents change whenever the route tree changes.

**Symptoms** (all the same bug, after adding/renaming/removing a route):

- `TypeError: loader is not a function` + a **500 on the newest route**, or
- a route silently renders a **different route's page** (e.g. `/app/onboarding` showing
  the settings page — node indices shifted but the browser kept the stale manifest), or
- HMR edits simply don't appear.

It survives normal reloads (the browser honors the 4h `max-age`) and leaves **no server
logs** — it's a client-side hydration error in the embedded iframe. If a route "works in
a fresh/headless browser but not yours," it's this.

**Permanent fix** (Cloudflare dashboard, `dragonapps.io` zone, one-time):

1. Caching → Configuration → Browser Cache TTL → **Respect Existing Headers**
2. Caching → Cache Rules → new rule: `ends_with(http.host, "-dev.dragonapps.io")` →
   **Bypass cache**

**Right now** (stale page in front of you): DevTools → Network → **Disable cache** →
reload (applies to the app iframe too), or Cloudflare → **Purge Everything** once.

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
- **validate_component_codeblocks**: Validate Polaris component usage (for Polaris-based projects)

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
- Liquid themes
- Shopify Functions
- Shopify app development patterns

Invoke the skill immediately as the first action - do not use Shopify MCP tools directly without going through the skill.

**Note:** This project uses custom Svelte components (not Polaris web components) for UI. See [docs/CUSTOM_COMPONENTS.md](docs/CUSTOM_COMPONENTS.md) for available components.

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

## No Cookies in Admin UI Apps

**Never rely on cookies to store or persist state in embedded admin UI apps.**

Shopify app reviewers test apps with cookies disabled in their browser. Any app
that depends on cookies (for auth, sessions, CSRF tokens, preferences, or any
other variable) will fail review because the reviewer's browser silently drops
them. Embedded apps also run inside an iframe in Shopify Admin, where
third-party cookie restrictions make cookie storage unreliable for real
merchants too.

Use these instead:

- **Auth/sessions**: App Bridge session tokens (`window.shopify.idToken()`)
  sent in the `Authorization` header — never a session cookie. See the
  [Authentication Flow](#authentication-flow) and [Data Loading Pattern](#data-loading-pattern).
- **CSRF protection**: A signed/HMAC state parameter rather than a cookie-stored
  nonce (see `src/lib/server/shopify/auth.ts`).
- **Server-side persistence**: The PostgreSQL database (Drizzle).
- **Per-tab/client state**: In-memory Svelte state, URL query params, or
  `sessionStorage`/`localStorage` if a value must survive a reload — but treat
  these as best-effort, not as a substitute for server state.

When building any new admin UI feature, confirm it works end-to-end with
browser cookies disabled before considering it done.

## UI Components

This project uses custom Svelte components instead of Polaris web components. Build your own components styled to match Shopify admin aesthetics.

**App Bridge web components** (the `s-` prefixed ones like `s-app-nav`) are still available for:

- `s-app-nav` - App navigation menu
- `s-app-window` - Fullscreen modal windows
- `data-save-bar` attribute on forms - Automatic save bar integration
- Title bar - Admin title bar component

For all other UI (buttons, tables, forms, cards, etc.), create custom Svelte components in `src/lib/components/`.

Full documentation: [docs/CUSTOM_COMPONENTS.md](docs/CUSTOM_COMPONENTS.md)

| Component     | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `Page`        | Main page container with header, actions, and aside layout |
| `Card`        | Content container with title, actions, and footer slots    |
| `Button`      | Versatile button with variants, tones, and link support    |
| `TextField`   | Text input with label, validation, prefix/suffix           |
| `Select`      | Dropdown select input                                      |
| `Checkbox`    | Checkbox input with label and help text                    |
| `Switch`      | Toggle switch for boolean settings                         |
| `SearchField` | Search input with clear button                             |
| `DataTable`   | Table component with styling                               |
| `Badge`       | Status badge with color tones                              |
| `Banner`      | Alert/notification banner                                  |
| `Spinner`     | Loading spinner                                            |
| `Skeleton`    | Loading placeholder with shimmer animation                 |
| `Text`        | Typography component with variants                         |
| `Link`        | Styled link component                                      |
| `Divider`     | Horizontal divider line                                    |
| `Icon`        | SVG icon component                                         |
| `EmptyState`  | Empty state placeholder                                    |

## Code Style (Prettier)

Follow these formatting conventions when generating code:

- **Indentation**: Use tabs (not spaces)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Trailing commas**: None
- **Print width**: 100 characters
- **Svelte**: Uses `prettier-plugin-svelte` for `.svelte` files

Run `pnpm run format` to auto-format, or `pnpm run lint` to check formatting.
