# Spec Delta

## Purpose

Lets any MCP-capable coding agent connect to a kb-hub vault over stdio, with clear errors when the vault is missing or misconfigured.

## ADDED Requirements

### Requirement: Server resolves the vault path
`kb-hub mcp` SHALL take the vault path from `--vault`, or from the `KB_VAULT` environment variable when `--vault` is not given. `--vault` wins when both are set. A leading `~` SHALL expand to the user's home folder.

#### Scenario: Vault from flag
- **WHEN** the server starts with `--vault ~/my-vault` and `KB_VAULT=/tmp/other`
- **THEN** the server uses the `my-vault` folder in the user's home

#### Scenario: Vault from environment
- **WHEN** the server starts without `--vault` and `KB_VAULT` points to a vault
- **THEN** the server uses the folder in `KB_VAULT`

### Requirement: Server refuses a folder that is not a vault
The server SHALL start only when the folder exists and contains `AGENTS.md`, `log.md` and `raw/inbox/`. Otherwise it SHALL exit with a non-zero code and write an error to stderr, never to stdout.

#### Scenario: No vault configured
- **WHEN** the server starts without `--vault` and without `KB_VAULT`
- **THEN** it exits with a non-zero code and stderr says to pass `--vault` or set `KB_VAULT`

#### Scenario: Folder is not a vault
- **WHEN** the server starts with `--vault ./notes` and `./notes` has no `AGENTS.md`
- **THEN** it exits with a non-zero code and stderr suggests running `kb-hub init ./notes`

### Requirement: Server speaks MCP over stdio
The server SHALL implement the MCP protocol over stdio, identify itself as `kb-hub` with the package version, and write nothing but protocol messages to stdout.

#### Scenario: Agent connects
- **WHEN** an MCP client connects and lists tools
- **THEN** the server answers with its name `kb-hub`, its version and its tool list

### Requirement: Health check tool
The server SHALL expose a `ping` tool that returns the absolute vault path and the kb-hub version, so a user can confirm the agent sees the right vault.

#### Scenario: Ping
- **WHEN** the agent calls `ping`
- **THEN** the result contains the absolute vault path and the version
