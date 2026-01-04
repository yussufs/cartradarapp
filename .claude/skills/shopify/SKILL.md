---
name: shopify
description: Use when the user asks about Shopify APIs, GraphQL queries, Polaris components, Liquid themes, or needs to validate Shopify code. Spawns a research subagent to keep context isolated.
---

# Shopify Development Research

When the user asks questions about Shopify development, you MUST spawn a subagent to do the research. This keeps the main conversation clean and focused.

## When to Use This Skill

Trigger this skill when the user asks about:
- Shopify Admin API or Storefront API
- GraphQL queries, mutations, or schema
- Polaris components or App Bridge
- Liquid templates or theme development
- Shopify Functions
- Validating GraphQL or component code

## How to Execute

1. **Spawn a research subagent** using the Task tool with `subagent_type: "general-purpose"`
2. In the subagent prompt, instruct it to:
   - Call `mcp__shopify-dev-mcp__learn_shopify_api` first with the appropriate API type
   - Use `mcp__shopify-dev-mcp__search_docs_chunks` to search documentation
   - Use `mcp__shopify-dev-mcp__introspect_graphql_schema` for GraphQL schema questions
   - Use `mcp__shopify-dev-mcp__validate_graphql_codeblocks` to validate GraphQL code
   - Use `mcp__shopify-dev-mcp__validate_component_codeblocks` to validate Polaris components
3. **Return a concise summary** of findings to the user

## Example Subagent Prompt

When spawning the subagent, use a prompt like:

```
Research Shopify documentation to answer: [USER'S QUESTION]

Steps:
1. Call learn_shopify_api with api="admin" (or appropriate API type)
2. Search docs or introspect schema as needed
3. If code is provided, validate it
4. Return a concise, actionable answer with code examples if helpful
```

## API Types for learn_shopify_api

- `admin` - Admin GraphQL API (most common)
- `storefront-graphql` - Storefront API
- `functions` - Shopify Functions
- `polaris-app-home` - Polaris for app home
- `polaris-admin-extensions` - Admin UI extensions
- `polaris-checkout-extensions` - Checkout extensions
- `liquid` - Liquid theme development

## Important

- Always spawn a subagent - do NOT call MCP tools directly in the main conversation
- This keeps research context isolated from the main conversation
- Return only the relevant findings, not the full exploration
