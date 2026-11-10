# Changelog

All notable changes to kb-hub are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-10

First release: a markdown knowledge vault that coding agents can search, read and write from any repo, over MCP.

### Added

- `kb-hub init <dir>` creates a vault with the LLM Wiki layout (`raw/inbox/`, `wiki/`, `projects/`, `outputs/`, `index.md`, `log.md`) and an `AGENTS.md` that tells agents how to search, capture and compile. It never writes into a non-empty folder.
- `kb-hub mcp --vault <dir>` (or `KB_VAULT`) starts an MCP server over stdio with five tools:
  - `ping`: shows which vault the agent is connected to.
  - `search`: full-text search over wiki pages, project notes and raw captures, with compiled pages ranked first. It picks up changes on disk without a restart.
  - `read`: returns a page's frontmatter and body. It refuses absolute paths, `..` and links that lead outside the vault, and suggests close names on a typo.
  - `capture`: saves a note to `raw/inbox/` stamped with repo, branch, commit and work item, read from git. It understands GitHub, SSH and Azure DevOps remotes, drops credentials, never overwrites a note, and logs every capture.
  - `status`: lists captures no wiki page cites yet, broken `[[wikilinks]]`, the latest log entries and page counts. It never calls a model.
- `KB_WORKITEM_PATTERN` to read work item IDs from other branch naming conventions.
- An example vault for a fictional store in `examples/demo-vault/`, and a VHS demo script in `demo/`.
- macOS, Windows and Linux support: native paths, CRLF-tolerant parsing, and `cmd /c npx` instructions for Claude Code on Windows.

[0.1.0]: https://github.com/jMautone/kb-hub/releases/tag/v0.1.0
