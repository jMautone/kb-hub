# Backlog

Where kb-hub stands and what comes next. The behavior contract lives in [`openspec/specs/`](../openspec/specs/); each item below becomes an OpenSpec change before any code is written.

Last updated: 12 November 2026.

## Status

**v0.1.0 is published** on [npm](https://www.npmjs.com/package/kb-hub) (12 November 2026) with a [GitHub release](https://github.com/jmautone/kb-hub/releases/tag/v0.1.0). It ships the MCP server with four tools on top of a shared `core`:

| Tool | What it does |
| --- | --- |
| `search` | Full-text search over the vault, wiki pages ranked above raw captures |
| `read` | Reads a page with its frontmatter, never outside the vault |
| `capture` | Saves a note to `raw/inbox/` stamped with repo, branch, commit and work item ID |
| `status` | Captures not yet compiled, broken `[[wikilinks]]`, latest log entries |

Plus `kb-hub init` to create a vault and `kb-hub mcp` to serve it.

## The idea

A markdown vault (the LLM Wiki pattern) that the coding agent in any repo can query and feed, so context doesn't have to be found and pasted by hand.

**Problem.** A manual knowledge base that agents can't see is half useful. In a big shared repo, not everyone can commit their specs, so notes, bug context and private specs live somewhere the agent never looks.

**What it is.** One vault and one tool with two faces over the same `core`: an MCP server for the agent and a CLI for the terminal.

**Use cases**

- Bug and feature context, available to the agent without searching for it.
- Initiatives and ideas noted on the fly.
- Specs that can't go into the shared repo: they live in the vault and the agent in the main repo uses them as context.
- Also: handoff between sessions, bug journal, personal map of a big repo, lightweight decisions, command recipes, domain glossary.

**What sets it apart.** The agent does the synthesis; kb-hub keeps the books: which captures are still uncompiled, broken links and stale pages. Every capture records repo, branch, commit and the work item ID when the branch name carries one.

**Vault layout**

```text
my-vault/
├── AGENTS.md          ← rules: page types, conventions, how to ingest, query and review
├── CLAUDE.md          ← just "@AGENTS.md"
├── index.md           ← catalog the agent maintains
├── log.md             ← append-only log
├── raw/inbox/         ← captures; never edited
├── wiki/              ← pages the agent compiles
├── projects/<repo>/   ← specs and notes per project
└── outputs/           ← answers, slides, diagrams
```

**Already out there** (surveyed 4 November 2026): llm-wiki-mcp, llmwiki and karpathy-llm-wiki (MCP servers and skills for the LLM Wiki pattern); qmd and Basic Memory (markdown search). kb-hub's angle is the bookkeeping and the git provenance of each capture.

## Roadmap

### v0.2

1. **CLI: `kb-hub status` and `kb-hub capture`** — high priority, pending. Requested by the maintainer on 12 November 2026 as the first item of v0.2. The same `status` and `capture` the agent gets over MCP, usable from a terminal, scripts and CI. Both commands reuse the `core` functions the MCP server already calls; `src/cli.ts` only parses arguments ([ADR 0002](decisions/0002-core-separate-from-mcp.md)). Goes before everything else in v0.2.
2. **Specs served from the vault (`kb link`).** Specs live in the vault and show up in the repo through a symlink ignored only on the local machine (`.git/info/exclude`). Untested idea: still needs a check with git worktrees.
3. **Skills** to ingest, query and review the vault.

### Later

- Stale-page and link checks.
- Export to the Azure DevOps Wiki: generate the `.order` files and turn `[[wikilinks]]` into markdown links.

### Candidate features

- **Session harvest:** a Claude Code hook sends what was learned to `raw/` when a session ends.
- **`kb pull`:** distribute `AGENTS.md`, standards and skills from the vault to several repos.
- **`kb promote`:** turn an idea in the vault into an OpenSpec change in the repo it belongs to.
- **Daily worklog:** the day's commits and work items become a daily note.
- **Drift check:** docs declare the code they describe in frontmatter (`sources`, `verified_at`) and a check flags the ones that went stale.
- **`kb map`:** browsable graph of the vault; Obsidian's graph view covers it meanwhile.
