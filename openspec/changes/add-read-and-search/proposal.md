# Proposal

## Why

The main pain kb-hub solves is pasting context by hand at the start of every agent session. With `search` and `read`, the agent in any repo can find and load what the vault knows about a bug, a feature or a term, on its own.

## What Changes

- New MCP tool `search(query, limit?)`: full-text search over `wiki/`, `projects/` and `raw/`, ranked so compiled wiki pages come before raw captures.
- New MCP tool `read(path)`: returns a page's frontmatter and body, and refuses any path outside the vault.
- The index is built in memory when the server starts and refreshed when files change on disk between calls.

Out of scope for v0.1: semantic or embedding search, searching `outputs/`, fuzzy matching tuned per language, writing wiki pages through MCP.

## Capabilities

### New Capabilities

- `page-read`: reading one vault page safely by its path.
- `search`: finding vault pages by text, with ranking and snippets.

### Modified Capabilities

None.

## Impact

- New: `src/core/pages.ts`, `src/core/search.ts`, `src/mcp/tools/read.ts`, `src/mcp/tools/search.ts`.
- Dependencies: `gray-matter`, `minisearch`.
