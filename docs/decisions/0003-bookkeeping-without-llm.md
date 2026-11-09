# 0003. The tool keeps the books, the agent writes

Date: 2026-11-09 · Status: accepted

## Context

Similar tools (for example llm-wiki-mcp) give the agent write access to wiki pages and leave health checks to agent-run skills, which spend tokens and are not deterministic.

## Decision

kb-hub never calls an LLM. It does the deterministic work: indexing, provenance from git, finding captures that no wiki page cites yet, and broken links. Compiling `raw/` into `wiki/` is the agent's job, guided by the vault's `AGENTS.md`.

## Consequences

- `status` is cheap and its output is the same every time for the same vault.
- In v0.1 the agent writes wiki pages with its own file tools; kb-hub only writes captures and the log.
