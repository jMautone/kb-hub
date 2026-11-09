# AGENTS.md

This folder is a **kb-hub vault**: a personal knowledge base that coding agents read and write. It follows the LLM Wiki pattern: raw captures come in, the agent compiles them into wiki pages, and the tool keeps the books.

## Folders

| Path | What goes there | Who writes it |
| --- | --- | --- |
| `raw/inbox/` | Captures: notes saved during work, with their provenance. Never edit them after they are written. | `capture` tool |
| `wiki/` | Compiled pages: one topic per page (a feature, a bug, a decision, a term, a recipe). | The agent, when compiling |
| `projects/<repo>/` | Notes and specs that belong to one repository and can't live in it. | You or the agent |
| `outputs/` | Answers, diagrams and drafts produced from the vault. Not searched. | The agent |
| `index.md` | Catalog of wiki and project pages, one line each. | The agent, when compiling |
| `log.md` | Append-only history of captures, compilations and reviews. | `capture` tool and the agent |

## Searching

Search the vault **before** asking the user for context, whenever a task mentions:

- a bug, incident, feature, module or work item by name or number;
- a business term you are not sure about;
- a decision ("why is it done this way?");
- a command, setup step or diagnostic query that might have been used before.

Use the `search` tool with two or three distinctive words, then `read` the most relevant pages. Prefer `wiki/` pages; fall back to `raw/` captures. Cite the pages you used by path.

## Capturing

Use the `capture` tool when something is worth remembering beyond this session:

- the root cause of a bug, and how it was found;
- a decision and the reason for it;
- a command, query or setup step that worked;
- context the user explained that is not written anywhere else.

Write captures so they make sense to someone who did not see the session: what, where, why, and what is still open. One topic per capture. Give it a short, specific title. Do not capture secrets, credentials or personal data.

## Compiling

Compiling turns captures into wiki pages. Do it in a session opened in this vault folder, when the user asks, or when `status` shows pending captures.

1. Run `status` to see pending captures.
2. For each capture, find the wiki page it belongs to (`search`), or create one in `wiki/` named in kebab-case (`checkout-flow.md`).
3. Merge the new knowledge into the page. Keep pages short and current; rewrite instead of appending when something changed.
4. Add the capture's path to the page's `sources` frontmatter. That is how `status` knows it was compiled.
5. Link related pages with `[[page-name]]`.
6. Update `index.md` and append a line to `log.md`: `## [YYYY-MM-DD] compile | <page>`.

Wiki page frontmatter:

```yaml
---
title: Checkout flow
tags: [checkout, payments]
updated: 2026-11-09
sources:
  - raw/inbox/2026-11-09-checkout-fails-with-expired-coupon.md
---
```

## Rules

- Never edit or delete files in `raw/`.
- Never rewrite earlier entries in `log.md`.
- Keep company secrets, credentials and personal data out of the vault.
