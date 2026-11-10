import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { listMarkdown, parsePage } from "./pages.js";

export type PendingCapture = { path: string; title: string; captured_at: string | null };
export type BrokenLink = { target: string; page: string };
export type VaultStatus = {
  pending: PendingCapture[];
  broken_links: BrokenLink[];
  recent_log: string[];
  counts: { wiki: number; projects: number; raw: number };
};

const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const nameOf = (p: string) => basename(p.replace(/\\/g, "/")).replace(/\.md$/i, "").trim().toLowerCase();

async function read(vault: string, rel: string) {
  return parsePage(rel, await readFile(join(vault, ...rel.split("/")), "utf8"));
}

/** Normalizes a `sources` entry: vault-relative path or [[name]], to both a path and a bare name. */
function citationKeys(source: unknown): string[] {
  if (typeof source !== "string") return [];
  const cleaned = source.trim().replace(/^\[\[|\]\]$/g, "").replace(/\\/g, "/").replace(/^\.\//, "");
  return [cleaned.toLowerCase(), nameOf(cleaned)];
}

/** Last `count` entries of log.md, newest first. An entry starts at a `## [` heading. */
export function recentLog(logText: string, count = 5): string[] {
  const entries: string[] = [];
  let current: string[] | null = null;
  for (const line of logText.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("## [")) {
      if (current) entries.push(current.join("\n").trim());
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push(current.join("\n").trim());
  return entries.slice(-count).reverse();
}

/** Deterministic bookkeeping of the vault: pending captures, broken links, recent log, counts. */
export async function vaultStatus(vault: string): Promise<VaultStatus> {
  const [compiled, raw, all] = await Promise.all([
    listMarkdown(vault, ["wiki", "projects"]),
    listMarkdown(vault, ["raw"]),
    listMarkdown(vault, ["wiki", "projects", "raw", "outputs"]),
  ]);
  const rootPages = ["AGENTS.md", "CLAUDE.md", "index.md", "log.md"];
  const knownNames = new Set([...all, ...rootPages].map(nameOf));

  const cited = new Set<string>();
  const broken: BrokenLink[] = [];
  for (const rel of compiled) {
    const page = await read(vault, rel);
    const sources = Array.isArray(page.frontmatter.sources) ? page.frontmatter.sources : [page.frontmatter.sources];
    for (const s of sources) for (const key of citationKeys(s)) cited.add(key);
    const body = page.body.replace(/```[\s\S]*?```/g, "");
    for (const match of body.matchAll(WIKILINK)) {
      const target = match[1]!.trim();
      if (!knownNames.has(nameOf(target))) broken.push({ target, page: rel });
    }
  }

  const pending: PendingCapture[] = [];
  for (const rel of raw.filter((p) => p.startsWith("raw/inbox/"))) {
    if (cited.has(rel.toLowerCase()) || cited.has(nameOf(rel))) continue;
    const page = await read(vault, rel);
    const at = page.frontmatter.captured_at;
    const capturedAt = typeof at === "string" ? at : (/^(\d{4}-\d{2}-\d{2})/.exec(basename(rel))?.[1] ?? null);
    pending.push({ path: rel, title: page.title, captured_at: capturedAt });
  }
  pending.sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? "") || a.path.localeCompare(b.path));
  broken.sort((a, b) => a.page.localeCompare(b.page) || a.target.localeCompare(b.target));

  let logText = "";
  try {
    logText = await readFile(join(vault, "log.md"), "utf8");
  } catch {
    logText = "";
  }

  return {
    pending,
    broken_links: broken,
    recent_log: recentLog(logText),
    counts: {
      wiki: compiled.filter((p) => p.startsWith("wiki/")).length,
      projects: compiled.filter((p) => p.startsWith("projects/")).length,
      raw: raw.length,
    },
  };
}

/** Short markdown summary an agent can show as is. */
export function formatStatus(s: VaultStatus): string {
  const lines = [`**Vault:** ${s.counts.wiki} wiki pages, ${s.counts.projects} project pages, ${s.counts.raw} raw captures.`, ""];
  lines.push(s.pending.length ? `**Pending captures (${s.pending.length}):**` : "**Pending captures:** none.");
  for (const p of s.pending) lines.push(`- ${p.path}: ${p.title}${p.captured_at ? ` (${p.captured_at.slice(0, 10)})` : ""}`);
  lines.push("", s.broken_links.length ? `**Broken links (${s.broken_links.length}):**` : "**Broken links:** none.");
  for (const b of s.broken_links) lines.push(`- [[${b.target}]] in ${b.page}`);
  lines.push("", "**Recent log:**");
  for (const e of s.recent_log) lines.push(`- ${e.split("\n")[0]!.replace(/^## /, "")}`);
  return lines.join("\n");
}
