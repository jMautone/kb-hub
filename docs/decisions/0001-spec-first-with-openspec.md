# 0001. Build spec-first with OpenSpec

Date: 2026-11-09 · Status: accepted

## Context

kb-hub is built mostly by a coding agent and has to stay reviewable by one person. The repo is also a public example of how the author works with agents.

## Decision

Every behavior change starts as an OpenSpec change (proposal, delta specs, design, tasks) using the default `spec-driven` schema. v0.1 is split into three changes, each one branch and one PR: `add-vault-init`, `add-read-and-search`, `add-capture-and-status`.

## Consequences

- The archive in `openspec/changes/archive/` shows how the tool grew, change by change.
- Small changes cost a few minutes of spec writing. Accepted.
