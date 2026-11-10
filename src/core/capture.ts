import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { link, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { appendLog } from "./log.js";
import { resolveInVault } from "./paths.js";
import { getProvenance, type Provenance, type ProvenanceOptions } from "./provenance.js";
import { stripMarkdown } from "./search.js";
import { isoDate } from "./vault.js";

export type CaptureInput = {
  text: string;
  title?: string;
  tags?: string[];
  /** Folder whose git repository gives the provenance. Defaults to the server's working directory. */
  cwd?: string;
};

export type CaptureResult = {
  /** Vault-relative path of the new note, with `/` separators. */
  path: string;
  title: string;
  tags: string[];
  captured_at: string;
  provenance: Provenance;
};

export type CaptureOptions = {
  /** Clock, for tests. */
  now?: Date;
  /** The server's working directory; `input.cwd` is resolved against it. Defaults to `process.cwd()`. */
  cwd?: string;
  provenance?: ProvenanceOptions;
};

/** The agent sent input that can't be captured. The message is shown to the agent as is. */
export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

const INBOX = "raw/inbox";
const SLUG_MAX = 60;
const DERIVED_TITLE_WORDS = 8;

/** Lowercase ASCII words joined by `-`, accents removed, at most 60 characters cut at a word boundary. */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= SLUG_MAX) return slug;
  const cut = slug.slice(0, SLUG_MAX + 1);
  const boundary = cut.lastIndexOf("-");
  return (boundary >= SLUG_MAX / 2 ? cut.slice(0, boundary) : slug.slice(0, SLUG_MAX)).replace(/-+$/, "");
}

/** A title from the first words of the first line that has any text once markdown is stripped. */
export function deriveTitle(text: string): string {
  for (const line of text.split("\n")) {
    const words = stripMarkdown(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")).split(" ").filter(Boolean);
    if (words.length === 0) continue;
    const title = words.slice(0, DERIVED_TITLE_WORDS).join(" ");
    return words.length > DERIVED_TITLE_WORDS ? `${title}…` : title;
  }
  return "Capture";
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanTags(tags: string[] | undefined): string[] {
  const out = (tags ?? []).map((t) => oneLine(t).replace(/^#+/, "").replace(/ /g, "-")).filter(Boolean);
  return [...new Set(out)];
}

/** Local time as ISO 8601 with the UTC offset, for example `2026-11-09T20:51:29-03:00`. */
export function isoWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${isoDate(date)}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const YAML_RESERVED = /^(?:true|false|yes|no|on|off|y|n|null|~)$/i;

/** A YAML scalar: plain when that is unambiguous, otherwise double-quoted (JSON strings are valid YAML). */
function yamlScalar(value: string | null, plain = /^[A-Za-z_][A-Za-z0-9_ ./()'-]*$/): string {
  if (value === null) return "null";
  if (plain.test(value) && !value.endsWith(" ") && !YAML_RESERVED.test(value)) return value;
  return JSON.stringify(value);
}

function frontmatter(title: string, tags: string[], capturedAt: string, p: Provenance): string {
  // Tags sit in a flow sequence, where spaces and commas would need quotes.
  const tagList = tags.map((t) => yamlScalar(t, /^[A-Za-z_][A-Za-z0-9_./-]*$/)).join(", ");
  return [
    "---",
    `title: ${yamlScalar(title)}`,
    `tags: [${tagList}]`,
    // Quoted so YAML parsers keep the offset instead of converting to a UTC date.
    `captured_at: ${JSON.stringify(capturedAt)}`,
    "provenance:",
    `  repo: ${yamlScalar(p.repo)}`,
    `  branch: ${yamlScalar(p.branch)}`,
    `  commit: ${yamlScalar(p.commit)}`,
    `  work_item: ${p.work_item === null ? "null" : JSON.stringify(p.work_item)}`,
    "---",
  ].join("\n");
}

const LINK_UNSUPPORTED = new Set(["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV", "EACCES"]);
const MAX_SUFFIX = 10_000;

function errorCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | undefined)?.code;
}

function candidate(stem: string, n: number): string {
  return n === 1 ? `${stem}.md` : `${stem}-${n}.md`;
}

/**
 * Writes `content` to `<stem>.md` in `dir`, or `<stem>-2.md`, `-3`, ... when the name is taken.
 * The note is written to a temp file and hard-linked into place, so it appears complete or not at all,
 * and an existing file is never replaced. File systems without hard links fall back to exclusive create.
 */
async function writeNewFile(dir: string, stem: string, content: string): Promise<string> {
  // Short, dot-prefixed and not .md, so search and status never see it; short also keeps Windows paths in bounds.
  const tmp = join(dir, `.capture-${randomUUID()}.tmp`);
  await writeFile(tmp, content, { encoding: "utf8", flag: "wx" });
  try {
    for (let n = 1; n <= MAX_SUFFIX; n++) {
      const name = candidate(stem, n);
      try {
        await link(tmp, join(dir, name));
        return name;
      } catch (err) {
        if (errorCode(err) === "EEXIST") continue;
        if (LINK_UNSUPPORTED.has(errorCode(err) ?? "")) return await writeExclusive(dir, stem, content, n);
        throw err;
      }
    }
  } finally {
    await rm(tmp, { force: true }).catch(() => undefined);
  }
  throw new Error(`Could not find a free file name for ${stem}.md`);
}

async function writeExclusive(dir: string, stem: string, content: string, from: number): Promise<string> {
  for (let n = from; n <= MAX_SUFFIX; n++) {
    const name = candidate(stem, n);
    try {
      await writeFile(join(dir, name), content, { encoding: "utf8", flag: "wx" });
      return name;
    } catch (err) {
      if (errorCode(err) !== "EEXIST") throw err;
    }
  }
  throw new Error(`Could not find a free file name for ${stem}.md`);
}

function existingFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Saves a note to `raw/inbox/<date>-<slug>.md` with provenance frontmatter and appends a `capture` entry to log.md.
 * Throws CaptureError for empty text or a `cwd` that is not a folder.
 */
export async function capture(vault: string, input: CaptureInput, options: CaptureOptions = {}): Promise<CaptureResult> {
  const text = input.text.replace(/\r\n/g, "\n");
  if (!text.trim()) throw new CaptureError("text must not be empty: write what you want to remember.");

  const serverCwd = options.cwd ?? process.cwd();
  const cwd = input.cwd === undefined ? serverCwd : resolve(serverCwd, input.cwd);
  if (!existingFolder(cwd)) throw new CaptureError(`cwd "${input.cwd}" is not an existing folder.`);

  const title = oneLine(input.title ?? "") || deriveTitle(text);
  const tags = cleanTags(input.tags);
  const now = options.now ?? new Date();
  const date = isoDate(now);
  const capturedAt = isoWithOffset(now);
  const provenance = await getProvenance(cwd, options.provenance);

  const inbox = resolveInVault(vault, INBOX);
  await mkdir(inbox, { recursive: true });
  const body = text.replace(/^\n+/, "").trimEnd();
  const content = `${frontmatter(title, tags, capturedAt, provenance)}\n\n${body}\n`;
  const name = await writeNewFile(inbox, `${date}-${slugify(title) || "capture"}`, content);
  const path = `${INBOX}/${name}`;

  await appendLog(vault, `## [${date}] capture | ${title}\n${path}\n`);
  return { path, title, tags, captured_at: capturedAt, provenance };
}
