# search Specification

## Purpose
Lets an agent find the vault pages relevant to a task by text, so it can load context without the user pasting it.

## Requirements

### Requirement: Search returns ranked results
The `search` tool SHALL take a non-empty `query` and an optional `limit` (default 10, maximum 50) and return results ordered by relevance, each with path, title, a snippet of up to 200 characters around the match, the folder kind (`wiki`, `project`, `raw`) and a score.

#### Scenario: Matching pages
- **WHEN** the agent searches for `checkout`
- **THEN** the result lists the pages that mention checkout, most relevant first, each with path, title, snippet, kind and score

#### Scenario: Limit
- **WHEN** the agent searches with `limit: 2` and five pages match
- **THEN** exactly two results are returned

#### Scenario: Invalid input
- **WHEN** the agent searches with an empty query or a limit above 50
- **THEN** the tool returns a validation error naming the bad field

### Requirement: Search scope
Search SHALL cover markdown files in `wiki/`, `projects/` and `raw/`, and SHALL ignore `outputs/`, the vault root files and any folder starting with a dot.

#### Scenario: Outputs are ignored
- **WHEN** a term only appears in `outputs/answer.md`
- **THEN** search returns no results for it

### Requirement: Compiled pages rank above raw captures
For pages with equal text relevance, pages in `wiki/` and `projects/` SHALL rank above pages in `raw/`.

#### Scenario: Same term in wiki and raw
- **WHEN** the term `refund` appears equally in `wiki/payments-glossary.md` and in a capture in `raw/inbox/`
- **THEN** the wiki page is listed first

### Requirement: Title and tags weigh more than body
Matches in the page title (frontmatter `title`, else the first `#` heading, else the file name) and in frontmatter `tags` SHALL weigh more than matches in the body.

#### Scenario: Title match
- **WHEN** one page has `Checkout flow` as title and another only mentions checkout once in the body
- **THEN** the page with the title match is listed first

### Requirement: Search sees recent changes
Search SHALL reflect files added, changed or deleted on disk since the previous call, without restarting the server.

#### Scenario: New page appears
- **WHEN** a new page is written to `wiki/` between two search calls
- **THEN** the second call can return it

#### Scenario: No results
- **WHEN** nothing matches the query
- **THEN** the tool returns an empty list and a hint to try fewer or different words
