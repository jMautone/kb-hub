# 0004. Provenance comes from the server's working directory

Date: 2026-11-10 · Status: accepted

## Context

`capture` stamps each note with the repo, branch, commit and work item it came from. kb-hub runs as an MCP server over stdio, so it does not know which project the agent is working in. MCP has "roots" for that, but clients don't all send them, and the server would need a round trip before every capture.

## Decision

kb-hub runs `git` in its own working directory. Claude Code starts stdio servers in the folder where `claude` was launched, which is the repo, so this works with no setup. `capture` takes an optional `cwd` for clients that start servers elsewhere, and its result says when no repository was found so the agent can retry with it. Checked in Claude Code 2.1 during `add-capture-and-status`.

## Consequences

- One server registered at user scope gives correct provenance in every repo.
- A client that starts servers in another folder records that folder's repo, or nothing, until the agent passes `cwd`. The README explains how to check with `ping` and a test capture.
- MCP roots can be added later as a third source without changing the note format.
