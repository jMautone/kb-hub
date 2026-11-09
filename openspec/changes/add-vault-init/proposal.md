# Proposal

## Why

kb-hub needs two things before any tool is useful: a vault with a known layout that agents can follow, and an MCP server that agents can start with `npx`. This change sets up the package and delivers both, with no tools yet beyond a health check.

## What Changes

- New npm package `kb-hub` (TypeScript, Node 22, ESM) with a `kb-hub` binary.
- `kb-hub init <dir>` creates a vault with the LLM Wiki layout and an `AGENTS.md` that tells agents how to use it.
- `kb-hub mcp --vault <dir>` (or `KB_VAULT`) starts an MCP server over stdio that refuses to start on a folder that is not a vault.
- An example vault with invented data in `examples/demo-vault/`, used by tests and the demo.
- CI on Windows, macOS and Linux.

Out of scope for v0.1: HTTP transport, several vaults at once, file watching, migrating an existing folder into a vault.

## Capabilities

### New Capabilities

- `vault-init`: creating a new vault with the standard layout and agent instructions.
- `mcp-server`: starting the MCP server against a vault and reporting configuration errors.

### Modified Capabilities

None.

## Impact

- New: `package.json`, `tsconfig.json`, `src/core/vault.ts`, `src/mcp/server.ts`, `src/cli.ts`, `templates/vault/`, `examples/demo-vault/`, `.github/workflows/ci.yml`.
- Dependencies: `@modelcontextprotocol/sdk`, `zod`, `commander`; dev: `typescript`, `tsup`, `vitest`, `@types/node`.
