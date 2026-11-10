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

- **Working directory for provenance.** Claude Code and most clients start stdio servers in the project folder, so `process.cwd()` is the repo. The optional `cwd` input covers clients that don't; a relative `cwd` is resolved against the server's working directory. `cwd` is only used to run git, never to read or write files, so it is not limited to the vault. Checked in Claude Code 2.1 (see the README and `docs/decisions/0004-provenance-from-server-cwd.md`).
- **git through `execFile`** with `rev-parse --show-toplevel`, `symbolic-ref --short -q HEAD`, `rev-parse --short HEAD` and `remote get-url origin`, each with a 2-second timeout, `windowsHide` and `GIT_TERMINAL_PROMPT=0`. `symbolic-ref` replaces `rev-parse --abbrev-ref HEAD` because it fails cleanly in detached HEAD and still names the branch in a repo with no commits yet. `GIT_DIR` and `GIT_WORK_TREE` are removed from git's environment so `cwd` always decides the repo. Alternative: `simple-git`; rejected as one more dependency for four calls.
- **Remote parsing** handles `https://host/owner/name(.git)`, `git@host:owner/name(.git)`, `https://dev.azure.com/org/project/_git/repo` and `org@vs-ssh.visualstudio.com:v3/org/project/repo`. Userinfo is dropped before parsing.
- **Remote parsing extras.** Paths are URL-decoded (Azure project names often have spaces), nested groups keep their full path (`group/sub/repo` on GitLab), and local-path or `file://` remotes fall back to the folder name. The raw remote URL is never stored.
- **Default work item pattern** `(?:^|/)(\d{2,})(?=[-_/]|$)`. Overridable with `KB_WORKITEM_PATTERN` for teams that use `AB#1234` or `PROJ-123` style names. The pattern is compiled when the server starts, so an invalid one stops the server with a clear message instead of failing on every capture.
- **git on Windows.** `execFile("git")` relies on Git for Windows being on PATH; if it is missing, provenance is `null` as the spec says. Paths returned by git use `/` and are normalized with `node:path` before comparing.
- **File locking on Windows.** On Windows, `rename` over an open file can fail with `EPERM`; captures always target a new file name, so this does not apply, and the log uses append mode.
- **Atomic writes.** Captures are written to a temp file in the same folder and hard-linked to the final name, then the temp file is removed. Unlike `rename`, `link` fails with `EEXIST` instead of replacing a file, so two captures with the same name in the same second can't overwrite each other, and the note appears complete or not at all. NTFS, APFS and ext4 support hard links without admin rights; on file systems that don't (FAT, some network drives) the write falls back to exclusive create (`wx`). Log entries use append mode, and a blank line is added first only when needed.
- **Frontmatter is written by hand**, not with a YAML library: values are plain when unambiguous and JSON-quoted otherwise (JSON strings are valid YAML), and the output is checked by parsing it back with gray-matter in tests. `captured_at` is always quoted, so YAML parsers keep the offset as written instead of turning it into a UTC date. `work_item` is always a quoted string.
- **Titles.** A missing title becomes the first eight words of the first line with text, markdown stripped. Slugs are ASCII kebab-case with accents removed, at most 60 characters, cut at a word boundary; an empty slug becomes `capture`.
- **Status output** is a structured object plus a short markdown summary in the tool's text content, so the agent can show it as is. Claude Code 2.1 passes only `structuredContent` to the model when a tool returns it, so the summary is also included there as `summary` (and capture's message as `message`).
- **Status reuses the search index.** The index keeps each parsed page next to its minisearch entry, and status reads them after the same mtime-and-size refresh. Only `outputs/` and the vault root are listed separately, to know which page names exist for link checks.
- **Link checks** ignore fenced and inline code, heading anchors (`[[page#heading]]`), escaped pipes inside tables (`[[page\|alias]]`) and embeds of attachments (`![[diagram.png]]`). Each broken target is reported once per page.

## Risks / Trade-offs

- [The client starts the server outside the repo, so provenance is wrong] → `cwd` input, and the README explains how to check it with `ping` and a test capture.
- [Large inbox makes status slow] → status reuses the search index's file list instead of walking the vault again.
- [Two captures in the same second collide] → suffix rule in the spec, covered by a test.
