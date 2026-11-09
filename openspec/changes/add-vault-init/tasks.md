# Tasks

## 1. Package setup

- [x] 1.1 Create `package.json` (name `kb-hub`, `type: module`, `bin.kb-hub: dist/cli.js`, `engines.node >=22`, `files: [dist, templates]`, MIT) and verify `npm install` succeeds
- [x] 1.2 Add `tsconfig.json` (strict, NodeNext), tsup config and scripts `build`, `dev`, `test`, `lint` (`tsc --noEmit`), and verify `npm run build` produces `dist/cli.js` with a shebang
- [x] 1.3 Add `.github/workflows/ci.yml` running lint, test and build on ubuntu, macos and windows with Node 22 (manual trigger only until Actions minutes are available), and add `npm run check` for the same checks locally; verify `npm run check` passes

## 2. Vault init

- [x] 2.1 Write `templates/vault/` (AGENTS.md with sections on folders, searching, capturing and compiling; CLAUDE.md; index.md; log.md; `.gitkeep` in each folder) and verify the files match the vault-init spec
- [x] 2.2 Implement `initVault(dir, date)` in `src/core/vault.ts` with the non-empty and already-a-vault rules, and verify with unit tests for every vault-init scenario
- [x] 2.3 Implement `isVault(dir)` and `resolveVaultPath(flag, env)` with `~` expansion, and verify with unit tests including a Windows-style path

## 3. CLI and MCP server

- [x] 3.1 Implement `src/cli.ts` with `init <dir>` and `mcp [--vault]` commands, and verify `node dist/cli.js init <tmp>` creates a vault in a test
- [x] 3.2 Implement `src/mcp/server.ts` with the stdio transport, server name and version, a stderr-only logger and the `ping` tool, and verify with a test that connects an MCP client to the spawned server and calls `ping`
- [x] 3.3 Add a test that the server exits non-zero with the right stderr message for each mcp-server error scenario, and that stdout stays empty

## 4. Example vault and docs

- [x] 4.1 Create `examples/demo-vault/` for the fictional store "Mate & Co." as described in design.md, and verify `isVault` accepts it
- [ ] 4.2 Update README "Quickstart" with the real commands for macOS and Windows (Windows needs `cmd /c npx` in `claude mcp add`) and verify them by hand on both OSes against the example vault

## Workflow follow-up

- Open the PR from `change/add-vault-init`, then archive the change with `/opsx:archive add-vault-init` after merge.
