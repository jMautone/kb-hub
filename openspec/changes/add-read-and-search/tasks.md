# Tasks

## 1. Pages and safe paths

- [ ] 1.1 Implement `resolveInVault(vault, rel)` in `src/core/paths.ts` and verify with unit tests for traversal, absolute POSIX and Windows paths, and a symlink pointing outside
- [ ] 1.2 Implement `loadPage(vault, rel)` with gray-matter and title fallback (frontmatter, first heading, file name), and verify with tests on pages with and without frontmatter
- [ ] 1.3 Add the `read` MCP tool with zod input, `.md`-only rule and closest-name suggestions, and verify every page-read scenario with a test through an MCP client

## 2. Search

- [ ] 2.1 Implement `SearchIndex` in `src/core/search.ts` (fields, boosts, kind boost, scope rules) and verify ranking and scope scenarios with unit tests on the example vault
- [ ] 2.2 Add incremental refresh by mtime and size, and verify the new-page and deleted-page scenarios with a test that edits a temp copy of the vault between calls
- [ ] 2.3 Add the `search` MCP tool with zod validation, snippets and the empty-result hint, and verify every search scenario through an MCP client
- [ ] 2.4 Add a benchmark test that generates 1,000 pages in a temp dir and verify a search answers in under 200 ms on CI

## 3. Docs

- [ ] 3.1 Document `read` and `search` in the README tools table with an example call and verify the example against the demo vault

## Workflow follow-up

- Open the PR from `change/add-read-and-search`, then archive with `/opsx:archive add-read-and-search` after merge.
