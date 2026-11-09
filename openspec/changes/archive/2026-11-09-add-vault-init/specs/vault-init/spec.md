# Spec Delta

## Purpose

Lets a user create a knowledge vault with the standard kb-hub layout and the instructions agents need to use it, in one command.

## ADDED Requirements

### Requirement: Init creates the vault layout
`kb-hub init <dir>` SHALL create `AGENTS.md`, `CLAUDE.md`, `index.md`, `log.md` and the folders `raw/inbox/`, `wiki/`, `projects/` and `outputs/` inside `<dir>`, creating `<dir>` if it does not exist.

#### Scenario: Init on a new folder
- **WHEN** the user runs `kb-hub init ./my-vault` and `./my-vault` does not exist
- **THEN** the folder is created with every file and folder of the layout
- **AND** the command exits with code 0 and prints the vault path and the next step to connect an agent

#### Scenario: Init on an empty existing folder
- **WHEN** the user runs `kb-hub init ./my-vault` and `./my-vault` exists and is empty
- **THEN** the layout is created inside it and the command exits with code 0

### Requirement: Init never overwrites content
`kb-hub init` SHALL refuse to run on a folder that already contains files. When the folder already is a vault, it SHALL change nothing and report that the vault exists.

#### Scenario: Init on a non-empty folder
- **WHEN** the user runs `kb-hub init ./notes` and `./notes` contains `todo.md`
- **THEN** no file is created or changed
- **AND** the command exits with a non-zero code and an error that names the folder and says it is not empty

#### Scenario: Init run twice
- **WHEN** the user runs `kb-hub init ./my-vault` on a folder that already is a vault
- **THEN** no file is created or changed
- **AND** the command exits with code 0 and reports that the vault already exists

### Requirement: Vault instructions for agents
The created `AGENTS.md` SHALL describe the page types, the folders, when to search the vault, how to capture, and how to compile captures from `raw/inbox/` into `wiki/` pages that list their sources in a `sources` frontmatter field. `CLAUDE.md` SHALL contain only `@AGENTS.md`.

#### Scenario: Instructions are present
- **WHEN** a vault is created
- **THEN** `AGENTS.md` contains sections on folders, searching, capturing and compiling
- **AND** `CLAUDE.md` content is exactly `@AGENTS.md` followed by a newline

### Requirement: Init works the same on macOS and Windows
Init SHALL accept native paths on each OS (including `C:\\Users\\...`, `%USERPROFILE%` already expanded by the shell, and paths with spaces) and SHALL write template files with LF line endings on every OS.

#### Scenario: Windows path with spaces
- **WHEN** on Windows the user runs `kb-hub init "C:\\Users\\Ana Perez\\my vault"`
- **THEN** the vault is created in that folder and the command exits with code 0

#### Scenario: Same files on both OSes
- **WHEN** a vault is created on macOS and another on Windows
- **THEN** both contain byte-identical template files

### Requirement: Log records vault creation
Init SHALL write a first entry to `log.md` with the date and the text `init`.

#### Scenario: First log entry
- **WHEN** a vault is created on 2026-11-09
- **THEN** `log.md` has one entry that starts with `## [2026-11-09] init`
