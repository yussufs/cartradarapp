---
name: shopify
description: Query Shopify API docs, validate GraphQL/components, or get Polaris/Liquid help. Use for any Shopify development questions.
---

# Shopify Development Assistant

When invoked, spawn a subagent with access to the Shopify MCP tools to:
- Search Shopify documentation
- Introspect the GraphQL schema
- Validate GraphQL queries and mutations
- Validate Polaris/UI component usage
- Validate Liquid theme code

## Usage
The user can invoke this with `/shopify` followed by their question or code to validate.

## MCP Tools Available
- `learn_shopify_api` - Initialize API context (call first)
- `search_docs_chunks` - Search documentation
- `introspect_graphql_schema` - Explore GraphQL types/queries/mutations
- `fetch_full_docs` - Get full documentation pages
- `validate_graphql_codeblocks` - Validate GraphQL code
- `validate_component_codeblocks` - Validate Polaris components
- `validate_theme` - Validate Liquid theme files
