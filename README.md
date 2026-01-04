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

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Database

Start the local PostgreSQL database:

```bash
docker compose up -d
```

Copy the environment file and push the database schema:

```bash
cp .env.example .env
pnpm run db:push
```

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
api_version = "2025-10"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

[access_scopes]
scopes = "write_products"

[auth]
redirect_urls = [ "https://your-app.com/auth/callback" ]
```

See `example-shopify.app.toml` for a complete reference.

> **Note:** In production, set `automatically_update_urls_on_dev = false` to prevent the CLI from overwriting your production URLs during development.

Pull Shopify credentials to your `.env` file:

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

Push schema changes to the database:

```bash
pnpm run db:push
```

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
3. Push schema: `pnpm run db:push`

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
