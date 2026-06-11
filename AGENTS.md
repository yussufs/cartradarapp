# SvelteKit Shopify App Template

This is a SvelteKit template for building embedded Shopify apps.

## Project Overview

- **Framework**: SvelteKit 2 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **API**: Shopify Admin GraphQL API
- **Authentication**: Shopify OAuth with session tokens
- **UI**: Polaris Web Components

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

## MCP Tools

You have access to the Svelte MCP server for Svelte 5 and SvelteKit documentation:

### list-sections

Discover available documentation sections. Use FIRST when asked about Svelte/SvelteKit topics.

### get-documentation

Retrieve full documentation for specific sections.

### svelte-autofixer

Analyze Svelte code for issues. Use when writing Svelte components.

### playground-link

Generate Svelte Playground links (only when requested by user).

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
  sent in the `Authorization` header — never a session cookie.
- **CSRF protection**: A signed/HMAC state parameter rather than a cookie-stored
  nonce (see `src/lib/server/shopify/auth.ts`).
- **Server-side persistence**: The PostgreSQL database (Drizzle).
- **Per-tab/client state**: In-memory state, URL query params, or
  `sessionStorage`/`localStorage` if a value must survive a reload — but treat
  these as best-effort, not as a substitute for server state.

When building any new admin UI feature, confirm it works end-to-end with
browser cookies disabled before considering it done.
