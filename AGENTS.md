# AGENTS.md

Instructions for coding agents working on **kb-hub**.

## What this repo is

kb-hub serves a markdown knowledge vault (LLM Wiki pattern) to coding agents through an MCP server, and records where every captured note came from (repo, branch, commit, work item). See `README.md` for the user view and `openspec/specs/` for the behavior contract.

## How work happens here: OpenSpec

All behavior changes go through OpenSpec. Do not write feature code without a change.

1. Pick the next change in `openspec/changes/` (they are ordered: `add-vault-init` → `add-read-and-search` → `add-capture-and-status`), or propose one with `/opsx:propose`.
2. Implement it with `/opsx:apply <change>`, ticking `tasks.md` as each task's verification passes.
3. Run `npx @fission-ai/openspec validate <change> --strict` before opening the PR.
4. After merge, archive it with `/opsx:archive <change>` so the main specs in `openspec/specs/` are updated.

One change, one branch, one PR. Branch name: `change/<change-name>`.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Build | `npm run build` |
| Test | `npm test` |
| Lint and types | `npm run lint` |
| Run the MCP server against the example vault | `npm run dev -- mcp --vault examples/demo-vault` |
| Inspect the server | `npx @modelcontextprotocol/inspector node dist/cli.js mcp --vault examples/demo-vault` |

## Code rules

- TypeScript strict, ESM, Node 22+.
- `src/core/` holds all logic and never imports the MCP SDK. `src/mcp/` is a thin adapter that maps tools to core functions. `src/cli.ts` only parses arguments.
- Every path that comes from a tool input is resolved and checked to be inside the vault before any read or write.
- Use `node:path` and never hard-code `/`. CI runs on Windows, macOS and Linux.
- Call `git` with `execFile`, never through a shell string.
- Tests live in `tests/` and use vitest. Tests that need a vault copy `examples/demo-vault` into a temp dir; they never write to the original.
- No real company data anywhere. Examples use the fictional store "Mate & Co.".

## Decisions

Architecture decisions live in `docs/decisions/` as short ADRs. Add one when a change makes a choice that someone could reasonably question later.
