# Design

## Context

Builds on `resolveInVault`, the page loader and the server from earlier changes. This is the change that carries the project's main idea: the agent writes, kb-hub keeps the books (see `docs/decisions/0003-bookkeeping-without-llm.md`).

## Goals / Non-Goals

**Goals:**
- Provenance that works with GitHub, Azure DevOps and plain local repos.
- A `status` that a user can read in five seconds.

**Non-Goals:**
- Compiling captures into wiki pages. The agent does it in a session opened at the vault, following the vault's `AGENTS.md`, and adds the capture to the page's `sources`.

## Decisions

- **Working directory for provenance.** Claude Code and most clients start stdio servers in the project folder, so `process.cwd()` is the repo. The optional `cwd` input covers clients that don't. The design is checked by hand in Claude Code during this change and the result is noted in the README.
- **git through `execFile`** with `rev-parse --show-toplevel`, `rev-parse --abbrev-ref HEAD`, `rev-parse --short HEAD` and `remote get-url origin`, each with a 2-second timeout. Alternative: `simple-git`; rejected as one more dependency for four calls.
- **Remote parsing** handles `https://host/owner/name(.git)`, `git@host:owner/name(.git)`, `https://dev.azure.com/org/project/_git/repo` and `org@vs-ssh.visualstudio.com:v3/org/project/repo`. Userinfo is dropped before parsing.
- **Default work item pattern** `(?:^|/)(\d{2,})(?=[-_/]|$)`. Overridable with `KB_WORKITEM_PATTERN` for teams that use `AB#1234` or `PROJ-123` style names.
- **git on Windows.** `execFile("git")` relies on Git for Windows being on PATH; if it is missing, provenance is `null` as the spec says. Paths returned by git use `/` and are normalized with `node:path` before comparing.
- **Exclusive create instead of temp-and-rename.** Captures are written with the `wx` flag, which fails if the name exists; on `EEXIST` the next suffix is tried. This never replaces a file even when two captures race, and avoids `rename` over an open file, which fails with `EPERM` on Windows. Log entries use append mode.
- **Status output** is a structured object plus a short markdown summary in the tool's text content, so the agent can show it as is.

## Risks / Trade-offs

- [The client starts the server outside the repo, so provenance is wrong] → `cwd` input, and the README explains how to check it with `ping` and a test capture.
- [Large inbox makes status slow] → status only lists and parses markdown files, with no index to build; a vault of a few thousand pages stays well under a second.
- [Two captures in the same second collide] → suffix rule in the spec, covered by a test.
