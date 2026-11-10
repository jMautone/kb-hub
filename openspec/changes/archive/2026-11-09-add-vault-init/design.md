# Design

## Context

Empty repo. This change fixes the package shape that the next two changes build on. See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- A package that runs with `npx kb-hub` on Windows, macOS and Linux.
- A layering that lets v0.3 add a terminal CLI without moving logic.

**Non-Goals:**
- Any read, search or write tool (next changes).

## Decisions

- **One package, three layers.** `src/core/` (pure logic, no MCP imports), `src/mcp/` (tool registration), `src/cli.ts` (commander). See `docs/decisions/0002-core-separate-from-mcp.md`. Alternative: a monorepo with `core`, `cli` and `mcp` packages; rejected for v0.1 because it adds release overhead for no user benefit yet.
- **Build with tsup to a single ESM bundle** in `dist/cli.js` with a shebang. Alternative: plain `tsc`; tsup gives a smaller install and a clean bin entry.
- **Templates are files, not strings.** `templates/vault/` is copied by `init`, so the vault's `AGENTS.md` can be read and edited as markdown. It is shipped in the npm package via `files`.
- **Vault detection** checks `AGENTS.md`, `log.md` and `raw/inbox/`. A marker file like `.kb-hub` was considered; rejected because a vault made by hand following the README should also work.
- **Example vault** `examples/demo-vault/` is about a fictional online store, "Mate & Co.": a few wiki pages (checkout flow, payments glossary, a past incident), two captures in `raw/inbox/` with provenance, one capture not yet compiled, and one deliberately broken wikilink so `status` has something to show.

## Risks / Trade-offs

- [Windows path handling and `~` expansion] → CI matrix on three OSes from the first PR.
- [stdout pollution breaks MCP] → all logging goes through a logger that writes to stderr; a test spawns the server and checks that stdout only carries JSON-RPC.
