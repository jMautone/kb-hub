import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { PathError, resolveInVault, toPosixRelative } from "./paths.js";

export type PageKind = "wiki" | "project" | "raw";

export type Page = {
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

/** Folders that hold searchable pages, and the kind of each. */
export const PAGE_FOLDERS: ReadonlyArray<readonly [string, PageKind]> = [
  ["wiki", "wiki"],
  ["projects", "project"],
  ["raw", "raw"],
];

export function kindOf(relPath: string): PageKind | undefined {
  const top = relPath.split("/")[0];
  return PAGE_FOLDERS.find(([folder]) => folder === top)?.[1];
}

/** Lists markdown files under `folder` (vault-relative), skipping dot-folders. Returns `/`-separated paths. */
export async function listMarkdown(vault: string, folders: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const folder of folders) {
    const dir = join(vault, folder);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
      const rel = toPosixRelative(vault, join(entry.parentPath, entry.name));
      if (rel.split("/").some((part) => part.startsWith("."))) continue;
      out.push(rel);
    }
  }
  return out.sort();
}

/** Turns YAML values gray-matter parsed into JSON-friendly ones (dates become YYYY-MM-DD or ISO strings). */
function toPlain(value: unknown): unknown {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

/** Parses page text: CRLF-tolerant, never fails on bad frontmatter. */
export function parsePage(relPath: string, text: string): Page {
  const normalized = text.replace(/\r\n/g, "\n");
  let frontmatter: Record<string, unknown> = {};
  let body = normalized;
  try {
    const parsed = matter(normalized);
    frontmatter = toPlain(parsed.data) as Record<string, unknown>;
    body = parsed.content.replace(/^\n+/, "");
  } catch {
    // Malformed frontmatter: serve the whole file as body.
  }
  return { path: relPath, title: titleOf(relPath, frontmatter, body), frontmatter, body };
}

function titleOf(relPath: string, frontmatter: Record<string, unknown>, body: string): string {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) return frontmatter.title.trim();
  const heading = /^#\s+(.+)$/m.exec(body);
  if (heading?.[1]) return heading[1].trim();
  return basename(relPath).replace(/\.md$/i, "");
}

/** Reads one page by vault-relative path. Throws PathError for unsafe, non-markdown or missing paths. */
export async function loadPage(vault: string, relPath: string): Promise<Page> {
  const abs = resolveInVault(vault, relPath);
  if (!relPath.toLowerCase().endsWith(".md")) {
    throw new PathError("not-markdown", `Only markdown pages (.md) can be read, got "${relPath}".`);
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    const suggestions = await suggestPaths(vault, relPath);
    const hint = suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : "";
    throw new PathError("not-found", `Page "${relPath}" not found.${hint}`);
  }
  const normalizedRel = toPosixRelative(vault, abs);
  return parsePage(normalizedRel, await readFile(abs, "utf8"));
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Up to three existing page paths closest to `wanted`. */
export async function suggestPaths(vault: string, wanted: string, max = 3): Promise<string[]> {
  const all = await listMarkdown(vault, ["wiki", "projects", "raw", "outputs"]);
  const target = wanted.replace(/\\/g, "/").toLowerCase();
  return all
    .map((p) => ({ p, d: levenshtein(p.toLowerCase(), target) }))
    .filter(({ p, d }) => d <= Math.max(3, Math.floor(p.length / 3)))
    .sort((x, y) => x.d - y.d || x.p.localeCompare(y.p))
    .slice(0, max)
    .map(({ p }) => p);
}
