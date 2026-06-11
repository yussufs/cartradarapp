# SvelteKit Shopify App Template

A modern SvelteKit template for building embedded Shopify apps with TypeScript, GraphQL, and PostgreSQL.

## Features

- **SvelteKit 2** - Fast, modern web framework with SSR
- **TypeScript** - Full type safety throughout
- **Shopify Admin API** - GraphQL client with automatic type generation
- **PostgreSQL + Drizzle ORM** - Type-safe database with session storage
- **OAuth Authentication** - Complete Shopify OAuth flow
- **Polaris Web Components** - Shopify's design system
- **Webhook Handling** - App uninstall and scope update webhooks

## Tech Stack

| Category        | Technology             |
| --------------- | ---------------------- |
| Framework       | SvelteKit 2            |
| Language        | TypeScript             |
| Database        | PostgreSQL             |
| ORM             | Drizzle                |
| API             | Shopify Admin GraphQL  |
| UI              | Polaris Web Components |
| Package Manager | pnpm                   |

## Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) 20.x or later
- [pnpm](https://pnpm.io/) package manager
- [Docker](https://docker.com/) (for local PostgreSQL) or a PostgreSQL instance
- [Shopify Partner Account](https://partners.shopify.com/)
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) installed globally

```bash
npm install -g @shopify/cli
```

## Quick Start

### 1. Clone or Use Template

```bash
# Clone the repository
git clone https://github.com/yussufs/svelteshopifytemplate.git my-shopify-app
cd my-shopify-app

# Or use as a template on GitHub
```

#### Track the template for future updates

Add this template as an `upstream` remote so you can pull in improvements later
without losing your own work. `origin` should point at your app's repository,
and `upstream` at this template.

```bash
# Add the template as an upstream remote
git remote add upstream https://github.com/yussufs/svelteshopifytemplate.git

# Disable pushing to upstream so you can't accidentally push to the template
git remote set-url --push upstream DISABLE

# Verify your remotes (upstream push should show DISABLE)
git remote -v

# Later, pull in template updates
git fetch upstream
git merge upstream/main   # or: git rebase upstream/main
```

The `set-url --push upstream DISABLE` line keeps `git fetch upstream` working
while making any `git push upstream` fail immediately (`DISABLE` is not a valid
URL), so you can never accidentally push your app's code back to the template.

Resolve any merge conflicts, then commit. Review the changes before merging,
since the template may update files you've customized.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Database

Start the local PostgreSQL database:

```bash
docker compose up -d
```

Copy the environment file and apply the database schema:

```bash
cp .env.example .env
pnpm run db:migrate
```

`db:migrate` applies the versioned SQL migrations in `drizzle/` to your
database — this is the recommended workflow (see
[Database Migrations](#database-migrations)). For quick local prototyping you
can instead use `pnpm run db:push`, which syncs `schema.ts` straight to the DB
without generating migration files.

### 4. Configure Shopify App

Link your app to a Shopify Partner app:

```bash
pnpm run config:link
```

This will:

- Create or connect to an app in your Partner Dashboard
- Create a `shopify.app.toml` file with your app's config
- Set up OAuth redirect URLs

After linking, update your `shopify.app.toml` with the recommended configuration (for dev):

```toml
[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true

[webhooks]
api_version = "2026-04"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

  [[webhooks.subscriptions]]
  compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
  uri = "/webhooks/compliance"

[access_scopes]
scopes = "write_products"

[auth]
redirect_urls = [ "https://your-app.com/auth/callback" ]
```

See `example-shopify.app.toml` for a complete reference.

> **Note:** In production, set `automatically_update_urls_on_dev = false` to prevent the CLI from overwriting your production URLs during development.

Pull Shopify credentials to your `.env` file - you may need to make sure you have at least some scopes defined:

```bash
shopify app env pull
```

This populates `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and other app credentials automatically.

### 5. Start Development

```bash
shopify app dev
```

This starts the development server with:

- Hot module replacement
- Automatic HTTPS tunnel
- Shopify authentication

Visit the URL shown in the terminal to install the app on a development store.

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/           # Database connection and schema
│   │   │   └── shopify/      # Shopify API client and auth
│   │   └── types/            # Generated GraphQL types
│   ├── routes/
│   │   ├── app/              # Protected app pages
│   │   ├── auth/             # OAuth flow
│   │   └── webhooks/         # Webhook handlers
│   ├── app.d.ts              # Global type definitions
│   └── hooks.server.ts       # Authentication middleware
├── shopify.web.toml          # Dev server configuration
├── drizzle.config.ts         # Database configuration
└── compose.yaml              # Docker PostgreSQL setup
```

## Configuration

### Environment Variables

| Variable             | Description                   | Required |
| -------------------- | ----------------------------- | -------- |
| `DATABASE_URL`       | PostgreSQL connection string  | Yes      |
| `SHOPIFY_API_KEY`    | App API key (auto-set by CLI) | Yes      |
| `SHOPIFY_API_SECRET` | App secret (auto-set by CLI)  | Yes      |
| `SHOPIFY_APP_URL`    | App URL (auto-set by CLI)     | Yes      |
| `SCOPES`             | OAuth scopes                  | Yes      |

### shopify.app.toml

This file configures your Shopify app:

```toml
client_id = "YOUR_CLIENT_ID"          # Set by `shopify app config link`
name = "My App Name"
application_url = "https://..."        # Auto-updated in dev
embedded = true

[access_scopes]
scopes = "write_products"              # Add scopes as needed

[webhooks]
api_version = "2025-10"
```

## Development

### GraphQL & Type Generation

Write GraphQL queries with the `#graphql` tag for automatic type generation:

```typescript
const response = await admin.graphql(
	`#graphql
    query GetShop {
      shop {
        name
        email
      }
    }
  `
);
```

Generate types after adding new queries:

```bash
pnpm run graphql-codegen
```

### Database Migrations

This template uses Drizzle's **migration** workflow: schema changes are turned
into versioned SQL files under `drizzle/` that you commit to source control and
apply to each environment. This gives you a reviewable, repeatable history and a
safe path to production (unlike `db:push`, which can make destructive changes
without a migration artifact).

After editing `src/lib/shared/db/schema.ts`, generate a migration:

```bash
pnpm run db:generate
```

Review the generated SQL in `drizzle/`, commit it, then apply it to the
database:

```bash
pnpm run db:migrate
```

On a fresh clone (or when deploying), run `pnpm run db:migrate` to bring the
database up to date with all committed migrations.

**Prototyping shortcut:** `pnpm run db:push` syncs `schema.ts` directly to the
database without creating a migration file. Handy for fast local iteration, but
don't rely on it for production — generate a migration before you commit.

Open Drizzle Studio to browse data:

```bash
pnpm run db:studio
```

### Adding OAuth Scopes

1. Update `shopify.app.toml`:

   ```toml
   [access_scopes]
   scopes = "write_products,read_orders"
   ```

2. Deploy the configuration:

   ```bash
   pnpm run deploy
   ```

3. Reinstall the app on your development store

## Claude Code Integration

This template includes a Shopify skill for [Claude Code](https://claude.ai/claude-code) that automatically spawns a research subagent when you ask about Shopify APIs, keeping your main conversation clean.

### Setting Up the Shopify MCP Server

Add the Shopify Dev MCP server using the Claude CLI:

```bash
claude mcp add shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
```

Restart Claude Code for changes to take effect.

### How the Skill Works

When you ask Claude about Shopify development topics, the skill automatically:

1. Detects Shopify-related questions (APIs, GraphQL, Polaris, Liquid, etc.)
2. Spawns a research subagent with access to Shopify's MCP tools
3. Returns concise, actionable answers without polluting your main conversation

**Example questions that trigger the skill:**

```
How do I create a product with GraphQL?
What fields are available on the Order type?
Validate this mutation: mutation { productCreate(input: {...}) { ... } }
How do I use the Card component in Polaris?
```

### Available MCP Tools

The subagent has access to these Shopify Dev MCP tools:

| Tool                            | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `learn_shopify_api`             | Initialize API context (Admin, Storefront, Functions, etc.) |
| `search_docs_chunks`            | Search Shopify documentation                                |
| `introspect_graphql_schema`     | Explore GraphQL types, queries, and mutations               |
| `fetch_full_docs`               | Retrieve complete documentation pages                       |
| `validate_graphql_codeblocks`   | Validate GraphQL code against the schema                    |
| `validate_component_codeblocks` | Validate Polaris/UI component usage                         |
| `validate_theme`                | Validate Liquid theme files                                 |

### Why Use a Skill with Subagents?

- **Isolated context**: Research and exploration stays in the subagent, not your main conversation
- **Cleaner responses**: Only relevant findings are returned, not the full exploration
- **Automatic detection**: No need to remember a command - just ask your question

## Authentication Flow

The app uses Shopify's OAuth with session tokens:

1. User accesses `/app` routes
2. `hooks.server.ts` validates the session token
3. If valid, `locals.shopify.admin` provides the GraphQL client
4. If invalid, redirects to OAuth flow at `/auth`

## Webhooks

Webhook handlers are in `src/routes/webhooks/`:

- `app/uninstalled` - Cleans up sessions when app is removed
- `app/scopes_update` - Handles OAuth scope changes

Add new webhooks in `shopify.app.toml`:

```toml
[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "/webhooks/orders/create"
```

## Deployment

### Build for Production

```bash
pnpm run build
```

### Deploy to Hosting

1. Set environment variables on your hosting platform
2. Update `application_url` in `shopify.app.toml`
3. Deploy configuration to Shopify:
   ```bash
   pnpm run deploy
   ```

### Recommended Hosts

- [Fly.io](https://fly.io)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Google Cloud Run](https://cloud.google.com/run)

### Multiple App Configurations (Dev/Prod)

For separate development and production apps, use multiple toml configuration files:

1. **Create separate configs** by linking to different apps:

   ```bash
   # Link to development app
   pnpm run config:link
   # This creates shopify.app.dev-app-name.toml

   # Link to production app
   pnpm run config:link
   # This creates shopify.app.prod-app-name.toml
   ```

2. **Switch between configurations**:

   ```bash
   # Use development config
   shopify app config use dev-app-name

   # Use production config
   shopify app config use prod-app-name
   ```

3. **Deploy to specific environment**:

   ```bash
   # Deploy using current config
   pnpm run deploy

   # Or specify config explicitly
   shopify app deploy --config=prod-app-name
   ```

Each config file stores:

- `client_id` - Unique app identifier
- `application_url` - App URL for that environment
- `redirect_urls` - OAuth callback URLs

The active config is tracked in `.shopify/project.json` (gitignored).

## Troubleshooting

### "Cannot find module '$env/dynamic/private'"

Run `pnpm run prepare` to generate SvelteKit types, then restart your IDE's TypeScript server.

### OAuth redirect errors

Ensure `redirect_urls` in `shopify.app.toml` matches your callback URL:

```toml
[auth]
redirect_urls = ["https://your-app.com/auth/callback"]
```

### Database connection errors

1. Verify PostgreSQL is running: `docker compose ps`
2. Check `DATABASE_URL` in `.env`
3. Apply migrations: `pnpm run db:migrate`

### GraphQL type errors

Regenerate types after changing queries:

```bash
pnpm run graphql-codegen
```

## Resources

- [Shopify App Development](https://shopify.dev/docs/apps)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Shopify Admin API](https://shopify.dev/docs/api/admin-graphql)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Polaris Web Components](https://shopify.dev/docs/api/app-home)

## License

MIT
