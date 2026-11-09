# Design

## Context

Builds on the server and vault helpers from `add-vault-init`. Vaults are expected to hold hundreds of pages, not tens of thousands.

## Goals / Non-Goals

**Goals:**
- Search answers in under 200 ms on a 1,000-page vault on a laptop.
- No index files on disk to keep in sync.

**Non-Goals:**
- Semantic search. If text search proves not enough in real use, v0.2+ can add an optional embedding backend behind the same tool.

## Decisions

- **minisearch in memory.** Fields `title` (boost 3), `tags` (boost 2), `body`. Prefix search and fuzzy 0.2 on. Alternatives: SQLite FTS5 (native dependency, painful with `npx` on Windows) and ripgrep (no ranking, external binary).
- **Kind boost applied after scoring.** `wiki` and `project` results get their score multiplied by 1.5; `raw` stays at 1. Simple and testable against the ranking scenario.
- **Freshness by mtime scan.** Before each search, list markdown files and compare `mtimeMs` and size with the indexed ones; re-index only the changed files and drop deleted ones. Avoids a file watcher (flaky across OSes and network drives). On 1,000 files a stat scan is a few milliseconds.
- **Safe path resolution in core.** `resolveInVault(vault, rel)` rejects absolute paths, normalizes, checks the result starts with the vault root, then calls `realpath` and checks again to catch symlinks. Reused by `capture` later.
- **Suggestions for missing pages** use Levenshtein distance on paths; no extra dependency.

## Risks / Trade-offs

- [Fuzzy matching returns noise for short queries] → fuzzy only for terms of 4+ characters.
- [Snippets cut inside markdown syntax] → snippets are taken from the body with markdown links and emphasis stripped.
