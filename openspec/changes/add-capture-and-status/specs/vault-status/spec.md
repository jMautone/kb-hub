# Spec Delta

## Purpose

Gives the user and the agent a deterministic, token-free view of what in the vault still needs work: captures not yet compiled and links that point nowhere.

## ADDED Requirements

### Requirement: Status lists pending captures
The `status` tool SHALL list every markdown file in `raw/inbox/` that is not cited in the `sources` frontmatter of any page in `wiki/` or `projects/`, with its path, title and capture date, oldest first. A citation SHALL match by vault-relative path or by file name without extension.

#### Scenario: One capture pending
- **WHEN** the inbox has three captures and wiki pages cite two of them in `sources`
- **THEN** status lists exactly the third capture as pending

#### Scenario: Nothing pending
- **WHEN** every capture is cited
- **THEN** the pending list is empty

### Requirement: Status lists broken wikilinks
The `status` tool SHALL list every `[[target]]` or `[[target|alias]]` link in `wiki/` and `projects/` whose target does not match the file name (without `.md`, case-insensitive) of any markdown page in the vault, with the page that contains it.

#### Scenario: Broken link
- **WHEN** `wiki/checkout-flow.md` links to `[[refund-policy]]` and no `refund-policy.md` exists
- **THEN** status lists `refund-policy` as broken in `wiki/checkout-flow.md`

#### Scenario: Link with alias
- **WHEN** a page links to `[[payments-glossary|glossary]]` and `wiki/payments-glossary.md` exists
- **THEN** the link is not reported

### Requirement: Status shows recent activity and totals
The `status` tool SHALL return the last five entries of `log.md` and the page count per folder (`wiki`, `projects`, `raw`).

#### Scenario: Recent log
- **WHEN** `log.md` has eight entries
- **THEN** status returns the last five, newest first

### Requirement: Status is cheap and deterministic
The `status` tool SHALL not call any external service or model, and SHALL return the same result for the same vault content.

#### Scenario: Repeated call
- **WHEN** status is called twice with no change in the vault
- **THEN** both results are identical
