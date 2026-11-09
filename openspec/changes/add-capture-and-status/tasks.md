# Tasks

## 1. Provenance

- [ ] 1.1 Implement remote URL parsing in `src/core/provenance.ts` and verify with unit tests for HTTPS, SSH, Azure DevOps HTTPS and SSH, and URLs with credentials
- [ ] 1.2 Implement `getProvenance(cwd)` with git calls and timeouts, and verify with tests that create temp git repos: normal branch, detached HEAD, no origin, not a repo
- [ ] 1.3 Implement work item extraction with the default pattern and `KB_WORKITEM_PATTERN`, and verify every work-item scenario with unit tests

## 2. Capture

- [ ] 2.1 Implement `appendLog(vault, entry)` in `src/core/log.ts` and verify it never rewrites earlier entries
- [ ] 2.2 Implement `capture(vault, input, now)` with slugging, collision suffixes and atomic write, and verify every capture scenario with unit tests
- [ ] 2.3 Add the `capture` MCP tool and verify through an MCP client that the file and log entry appear in a temp vault, with provenance from a temp git repo passed as `cwd`

## 3. Status

- [ ] 3.1 Implement pending-capture detection and broken wikilink detection in `src/core/status.ts`, and verify every vault-status scenario against a temp copy of the example vault
- [ ] 3.2 Add the `status` MCP tool with the structured result and markdown summary, and verify the output on the example vault matches a snapshot test

## 4. End to end and docs

- [ ] 4.1 Check by hand in Claude Code that a capture made from a repo gets that repo's provenance without `cwd`, and record the result in the README
- [ ] 4.2 Write `demo/demo.tape` (VHS) running init, capture, status and search through the MCP Inspector CLI, and verify it renders `demo/demo.gif`
- [ ] 4.3 Complete the README (tools table, quickstart, suggested `~/.claude/CLAUDE.md` snippet, provenance notes) and verify every command in it runs as written

## Workflow follow-up

- Open the PR from `change/add-capture-and-status`, then archive with `/opsx:archive add-capture-and-status` after merge.
- Then follow the release checklist: CI badge, CHANGELOG, tag `v0.1.0`, `npm publish`.
