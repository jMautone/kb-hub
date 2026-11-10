import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProvenance, type Provenance } from "./provenance.js";
import { appendLog, isoDate } from "./vault.js";

export type CaptureInput = {
  text: string;
  title?: string;
  tags?: string[];
  /** Folder to read git provenance from. Defaults to the server's working directory. */
  cwd?: string;
};

export type CaptureResult = {
  path: string;
  title: string;
  captured_at: string;
  provenance: Provenance;
};

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

/** Lowercase ASCII kebab-case, without accents, at most 60 characters. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "note";
}

/** The first words of the text, used when there is no title. */
export function titleFromText(text: string, words = 8): string {
  const firstLine = text.trim().split("\n")[0]!.replace(/^#+\s*/, "");
  const parts = firstLine.split(/\s+/).filter(Boolean);
  return parts.slice(0, words).join(" ") + (parts.length > words ? "…" : "");
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-09T16:42:10-03:00. */
export function isoWithOffset(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${isoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/** YAML scalar: JSON strings are valid YAML and never ambiguous. */
const yaml = (value: string | null) => (value === null ? "null" : JSON.stringify(value));

function frontmatter(title: string, tags: string[], capturedAt: string, p: Provenance): string {
  return [
    "---",
    `title: ${yaml(title)}`,
    `tags: [${tags.map(yaml).join(", ")}]`,
    `captured_at: ${capturedAt}`,
    "provenance:",
    `  repo: ${yaml(p.repo)}`,
    `  branch: ${yaml(p.branch)}`,
    `  commit: ${yaml(p.commit)}`,
    `  work_item: ${yaml(p.work_item)}`,
    "---",
    "",
  ].join("\n");
}

/** Writes a new note to raw/inbox/ with provenance, and logs it. Never overwrites an existing file. */
export async function capture(vault: string, input: CaptureInput, now = new Date()): Promise<CaptureResult> {
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (!text) throw new CaptureError("text must not be empty.");
  const title = input.title?.trim() || titleFromText(text);
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);

  const cwd = input.cwd ?? process.cwd();
  if (input.cwd !== undefined && !(existsSync(cwd) && statSync(cwd).isDirectory())) {
    throw new CaptureError(`cwd "${input.cwd}" is not an existing folder.`);
  }
  const provenance = await getProvenance(cwd);
  const capturedAt = isoWithOffset(now);
  const content = `${frontmatter(title, tags, capturedAt, provenance)}\n${text}\n`;

  const inbox = join(vault, "raw", "inbox");
  await mkdir(inbox, { recursive: true });
  const base = `${isoDate(now)}-${slugify(title)}`;
  let fileName = "";
  for (let n = 1; ; n++) {
    fileName = n === 1 ? `${base}.md` : `${base}-${n}.md`;
    try {
      // Exclusive create: never replaces a file, even if two captures race for the same name.
      await writeFile(join(inbox, fileName), content, { encoding: "utf8", flag: "wx" });
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }

  const relPath = `raw/inbox/${fileName}`;
  await appendLog(vault, `## [${isoDate(now)}] capture | ${title.replace(/\n/g, " ")}\n${relPath}\n`);
  return { path: relPath, title, captured_at: capturedAt, provenance };
}
