import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import MiniSearch from "minisearch";
import { kindOf, listMarkdown, PAGE_FOLDERS, parsePage, type Page, type PageKind } from "./pages.js";

export type SearchResult = {
  path: string;
  title: string;
  snippet: string;
  kind: PageKind;
  score: number;
};

type IndexedDoc = { id: string; title: string; tags: string; body: string; kind: PageKind; plain: string };

const KIND_BOOST: Record<PageKind, number> = { wiki: 1.5, project: 1.5, raw: 1 };
const SNIPPET_MAX = 200;

/** Removes markdown syntax that would make snippets noisy. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(plain: string, terms: string[]): string {
  const lower = plain.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (plain.length <= SNIPPET_MAX) return plain;
  const start = Math.max(0, (at === -1 ? 0 : at) - 60);
  const end = Math.min(plain.length, start + SNIPPET_MAX - 2);
  return `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`.slice(0, SNIPPET_MAX);
}

/**
 * In-memory full-text index over wiki/, projects/ and raw/.
 * Before each search it re-stats the files and re-indexes only what changed.
 */
export class SearchIndex {
  private readonly mini = new MiniSearch<IndexedDoc>({
    fields: ["title", "tags", "body"],
    storeFields: ["title", "kind", "plain"],
    searchOptions: {
      boost: { title: 3, tags: 2 },
      prefix: true,
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      combineWith: "OR",
      boostDocument: (_id, _term, stored) => KIND_BOOST[(stored?.kind as PageKind) ?? "raw"],
    },
  });
  private readonly seen = new Map<string, string>();
  private readonly parsed = new Map<string, Page>();

  constructor(private readonly vault: string) {}

  /** Brings the index in line with the files on disk. */
  async refresh(): Promise<void> {
    const paths = await listMarkdown(
      this.vault,
      PAGE_FOLDERS.map(([folder]) => folder),
    );
    const current = new Set(paths);
    for (const id of [...this.seen.keys()]) {
      if (!current.has(id)) {
        this.mini.discard(id);
        this.seen.delete(id);
        this.parsed.delete(id);
      }
    }
    for (const rel of paths) {
      const abs = join(this.vault, ...rel.split("/"));
      let signature: string;
      try {
        const s = await stat(abs);
        signature = `${s.mtimeMs}:${s.size}`;
      } catch {
        continue; // deleted between listing and stat
      }
      if (this.seen.get(rel) === signature) continue;
      const page = parsePage(rel, await readFile(abs, "utf8"));
      const tags = Array.isArray(page.frontmatter.tags) ? page.frontmatter.tags.join(" ") : String(page.frontmatter.tags ?? "");
      const doc: IndexedDoc = {
        id: rel,
        title: page.title,
        tags,
        body: page.body,
        kind: kindOf(rel) ?? "raw",
        plain: stripMarkdown(page.body),
      };
      if (this.seen.has(rel)) this.mini.discard(rel);
      this.mini.add(doc);
      this.seen.set(rel, signature);
      this.parsed.set(rel, page);
    }
  }

  /** The parsed pages as of the last refresh, sorted by path. Lets status reuse the index instead of re-reading files. */
  pages(): Page[] {
    return [...this.parsed.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    await this.refresh();
    const hits = this.mini.search(query);
    return hits.slice(0, limit).map((hit) => ({
      path: hit.id as string,
      title: hit.title as string,
      snippet: makeSnippet(hit.plain as string, hit.terms),
      kind: hit.kind as PageKind,
      score: Math.round(hit.score * 1000) / 1000,
    }));
  }
}
