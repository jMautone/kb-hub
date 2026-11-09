# Spec Delta

## Purpose

Lets an agent save what it learned in a session into the vault inbox from any repo, stamped with where and when it was captured, so it can be compiled and traced later.

## ADDED Requirements

### Requirement: Capture writes a new inbox note
The `capture` tool SHALL take a non-empty `text`, and optional `title` and `tags`, and write a new markdown file in `raw/inbox/` named `<YYYY-MM-DD>-<slug>.md`, where the slug comes from the title, or from the first words of the text when there is no title.

#### Scenario: Capture with title
- **WHEN** on 2026-11-09 the agent captures text with title `Checkout fails with expired coupon`
- **THEN** the file `raw/inbox/2026-11-09-checkout-fails-with-expired-coupon.md` is created with the text as body
- **AND** the result returns the vault-relative path of the new file

#### Scenario: Name collision
- **WHEN** a capture would produce a file name that already exists
- **THEN** a numeric suffix is added (`-2`, `-3`, ...) and the existing file is not changed

#### Scenario: Empty text
- **WHEN** the agent calls `capture` with empty or whitespace-only text
- **THEN** the tool returns a validation error and no file is written

### Requirement: Capture records provenance
The note's frontmatter SHALL include `title`, `tags`, `captured_at` (ISO 8601 with offset), and a `provenance` object with `repo`, `branch`, `commit` (short hash) and `work_item`, taken from the git repository at `cwd`, or at the server's working directory when `cwd` is not given.

#### Scenario: Capture inside a git repo
- **WHEN** the agent captures from repo `mate-and-co/storefront` on branch `feature/4821-checkout` at commit `9f3c2ab`
- **THEN** the frontmatter has `provenance.repo: mate-and-co/storefront`, `branch: feature/4821-checkout`, `commit: 9f3c2ab` and `work_item: "4821"`

#### Scenario: Capture outside a git repo
- **WHEN** the working directory is not inside a git repository, or git is not installed
- **THEN** the note is still written and every provenance field is `null`

#### Scenario: Detached HEAD
- **WHEN** the repository is in detached HEAD state
- **THEN** `branch` is `null` and `commit` holds the current short hash

### Requirement: Repo name is portable
`provenance.repo` SHALL be `<owner>/<name>` parsed from the `origin` remote URL (HTTPS, SSH and Azure DevOps formats), and the name of the repository's top-level folder when there is no `origin`. Credentials in the URL SHALL never be stored.

#### Scenario: Azure DevOps remote
- **WHEN** origin is `https://user@dev.azure.com/contoso/Shop/_git/storefront`
- **THEN** `provenance.repo` is `contoso/Shop/storefront` and the note contains no `user@`

### Requirement: Work item from branch name
The work item ID SHALL be the first run of two or more digits in the branch name that starts the name or follows a `/`, unless `KB_WORKITEM_PATTERN` is set, in which case its first capture group is used.

#### Scenario: Default pattern
- **WHEN** the branch is `bugfix/77-null-cart`
- **THEN** `work_item` is `"77"`

#### Scenario: No ID in branch
- **WHEN** the branch is `main`
- **THEN** `work_item` is `null`

### Requirement: Capture appends to the log
Each capture SHALL append one entry to `log.md` of the form `## [YYYY-MM-DD] capture | <title>` followed by the new file's path, and SHALL never rewrite earlier entries.

#### Scenario: Log entry
- **WHEN** a capture titled `Checkout fails with expired coupon` is saved
- **THEN** the last entry of `log.md` is `## [2026-11-09] capture | Checkout fails with expired coupon` with the path on the next line
