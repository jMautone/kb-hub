# page-read Specification

## Purpose
Lets an agent load the full content and metadata of one vault page, without ever reaching files outside the vault.

## Requirements

### Requirement: Read returns frontmatter and body
The `read` tool SHALL take a path relative to the vault root, using `/` as separator on every OS, and return the page's frontmatter as an object, its body as text, and the path as given.

#### Scenario: Read a wiki page
- **WHEN** the agent calls `read` with `wiki/checkout-flow.md`
- **THEN** the result contains the frontmatter fields of that page and its markdown body without the frontmatter block

#### Scenario: Page without frontmatter
- **WHEN** the agent reads a page that has no frontmatter
- **THEN** the frontmatter in the result is an empty object and the body is the whole file

### Requirement: Read stays inside the vault
The `read` tool SHALL reject absolute paths, paths that resolve outside the vault after normalization, and paths that reach outside the vault through a symlink.

#### Scenario: Path traversal
- **WHEN** the agent calls `read` with `../secrets.md`
- **THEN** the tool returns an error saying the path is outside the vault, and no file is read

#### Scenario: Absolute path
- **WHEN** the agent calls `read` with `/etc/passwd` or `C:\Windows\win.ini`
- **THEN** the tool returns an error saying only vault-relative paths are accepted

### Requirement: Read reports missing pages helpfully
When the path does not exist, the `read` tool SHALL return an error that includes up to three existing page paths with the closest names.

#### Scenario: Typo in path
- **WHEN** the agent calls `read` with `wiki/chekout-flow.md`
- **THEN** the tool returns a not-found error that suggests `wiki/checkout-flow.md`

### Requirement: Read only serves markdown
The `read` tool SHALL only read files ending in `.md`.

#### Scenario: Non-markdown file
- **WHEN** the agent calls `read` with `outputs/diagram.png`
- **THEN** the tool returns an error saying only markdown pages can be read
