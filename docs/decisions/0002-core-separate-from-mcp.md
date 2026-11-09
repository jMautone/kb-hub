# 0002. Keep the core independent of MCP

Date: 2026-11-09 · Status: accepted

## Context

v0.1 exposes the vault only through an MCP server, but v0.3 adds a terminal CLI (`kb add`, `kb push`) over the same operations.

## Decision

All logic lives in `src/core/` as plain functions that take a vault path and return data. `src/mcp/` maps MCP tools onto those functions and does nothing else. One npm package, no monorepo, until a second package is actually needed.

## Consequences

- The CLI in v0.3 is a second thin adapter, not a rewrite.
- Core is tested without starting a server.
