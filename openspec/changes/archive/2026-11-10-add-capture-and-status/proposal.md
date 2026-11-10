# Proposal

## Why

What an agent learns in a session (a root cause, a decision, a command that worked) is lost when the session ends. `capture` lets the agent save it from any repo, stamped with where it came from. `status` is the bookkeeping that tells the user and the agent what still needs to be compiled into the wiki and what is broken, without spending tokens. Together they are what sets kb-hub apart from plain markdown MCP servers.

## What Changes

- New MCP tool `capture(text, title?, tags?, cwd?)`: writes a new note to `raw/inbox/` with provenance frontmatter (repo, branch, commit, work item ID, captured date) and appends an entry to `log.md`.
- New MCP tool `status()`: lists captures that no compiled page cites yet, broken `[[wikilinks]]`, and the latest log entries.
- Work item IDs are read from the branch name with a default pattern that can be overridden with `KB_WORKITEM_PATTERN`.

Out of scope for v0.1: editing or deleting captures, stale-page detection, drift against source code, a terminal command for capturing.

## Capabilities

### New Capabilities

- `capture`: saving a note into the vault inbox with its provenance.
- `vault-status`: reporting what is pending and what is broken in the vault.

### Modified Capabilities

None.

## Impact

- New: `src/core/provenance.ts`, `src/core/capture.ts`, `src/core/log.ts`, `src/core/status.ts`, `src/mcp/tools/capture.ts`, `src/mcp/tools/status.ts`.
- Calls the `git` binary when available. No new npm dependencies.
