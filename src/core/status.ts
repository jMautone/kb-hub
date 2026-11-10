import { readdir } from "node:fs/promises";
import { listMarkdown, type Page } from "./pages.js";
import { recentLog, type LogEntry } from "./log.js";
import type { SearchIndex } from "./search.js";

export type PendingCapture = {
  path: string;
  title: string;
  /** `YYYY-MM-DD`, from the file name, or from `captured_at` when the name has no date. */
  date: string | null;
  captured_at: string | null;
};

export type BrokenLink = {
  /** Vault-relative path of the page that has the link. */
  page: string;
  /** The link target as written, without alias or heading. */
  target: string;
};

export type VaultStatus = {
  pending: PendingCapture[];
  broken_links: BrokenLink[];
  recent_log: LogEntry[];
  totals: { wiki: number; projects: number; raw: number };
};

const INBOX_PREFIX = "raw/inbox/";
const RECENT_LOG_ENTRIES = 5;
/** Obsidian-style embeds of these files are attachments, not pages, so they are not checked. */
const ATTACHMENT = /\.(?:png|jpe?g|gif|svg|webp|bmp|pdf|mp3|mp4|mov|wav|webm|csv|xlsx?|docx?|pptx?|zip|canvas|excalidraw|base)$/i;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lowercase, `/`-separated, without `./`, wikilink brackets, alias or `.md`. */
function normalizeRef(ref: string): string {
  return ref
    .trim()
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]!
    .split("#")[0]!
    .trim()
    .replace(/\\$/, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function fileStem(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "").toLowerCase();
}

function sourcesOf(page: Page): string[] {
  const sources = page.frontmatter.sources;
  if (typeof sources === "string") return [sources];
  if (Array.isArray(sources)) return sources.filter((s): s is string => typeof s === "string");
  return [];
}

function isCompiled(page: Page): boolean {
  return page.path.startsWith("wiki/") || page.path.startsWith("projects/");
}

/** Captures in raw/inbox/ that no wiki or project page cites in `sources`, oldest first. */
export function pendingCaptures(pages: Page[]): PendingCapture[] {
  const citedPaths = new Set<string>();
  const citedNames = new Set<string>();
  for (const page of pages.filter(isCompiled)) {
    for (const source of sourcesOf(page)) {
      const ref = normalizeRef(source);
      if (!ref) continue;
      if (ref.includes("/")) citedPaths.add(ref);
      else citedNames.add(ref);
    }
  }

  const pending = pages
    .filter((p) => p.path.startsWith(INBOX_PREFIX))
    .filter((p) => !citedPaths.has(normalizeRef(p.path)) && !citedNames.has(fileStem(p.path)))
    .map((p): PendingCapture => {
      const capturedAt = typeof p.frontmatter.captured_at === "string" ? p.frontmatter.captured_at : null;
      const fromName = /^(\d{4}-\d{2}-\d{2})/.exec(p.path.slice(p.path.lastIndexOf("/") + 1))?.[1];
      const fromField = capturedAt && /^(\d{4}-\d{2}-\d{2})/.exec(capturedAt)?.[1];
      return { path: p.path, title: p.title, date: fromName ?? fromField ?? null, captured_at: capturedAt };
    });

  const time = (c: PendingCapture) => {
    const t = Date.parse(c.captured_at ?? c.date ?? "");
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  return pending.sort((a, b) => time(a) - time(b) || compare(a.path, b.path));
}

/** Blanks out fenced code blocks and inline code, where `[[...]]` is not a link. */
function withoutCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");
}

/** `[[target]]` and `[[target|alias]]` links in wiki and project pages whose target matches no markdown page. */
export function brokenLinks(pages: Page[], pageNames: ReadonlySet<string>): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const page of pages.filter(isCompiled)) {
    const seen = new Set<string>();
    for (const match of withoutCode(page.body).matchAll(/\[\[([^[\]\n]+)\]\]/g)) {
      // Inside a table the alias pipe is escaped: [[target\|alias]].
      const target = match[1]!.split("|")[0]!.split("#")[0]!.replace(/\\$/, "").trim();
      if (!target || ATTACHMENT.test(target) || seen.has(target)) continue;
      seen.add(target);
      if (!pageNames.has(fileStem(normalizeRef(target)))) broken.push({ page: page.path, target });
    }
  }
  return broken.sort((a, b) => compare(a.page, b.page) || compare(a.target, b.target));
}

/** File names (lowercase, without `.md`) of every markdown page in the vault. */
async function allPageNames(vault: string, indexed: Page[]): Promise<Set<string>> {
  const names = new Set(indexed.map((p) => fileStem(p.path)));
  for (const path of await listMarkdown(vault, ["outputs"])) names.add(fileStem(path));
  for (const entry of await readdir(vault, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) names.add(fileStem(entry.name));
  }
  return names;
}

/**
 * The vault's bookkeeping: captures not compiled yet, broken wikilinks, the latest log entries and page counts.
 * Reuses the search index's pages, so only files that changed since the last call are read again.
 * Never calls a model; the same vault content always gives the same result.
 */
export async function vaultStatus(vault: string, index: SearchIndex): Promise<VaultStatus> {
  await index.refresh();
  const pages = index.pages();
  const count = (prefix: string) => pages.filter((p) => p.path.startsWith(prefix)).length;
  return {
    pending: pendingCaptures(pages),
    broken_links: brokenLinks(pages, await allPageNames(vault, pages)),
    recent_log: await recentLog(vault, RECENT_LOG_ENTRIES),
    totals: { wiki: count("wiki/"), projects: count("projects/"), raw: count("raw/") },
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A short markdown summary of the status, meant to be shown to the user as is. */
export function formatStatus(status: VaultStatus): string {
  const { pending, broken_links: broken, recent_log: log, totals } = status;
  const lines = [
    `**Vault:** ${plural(totals.wiki, "wiki page", "wiki pages")}, ${plural(totals.projects, "project page", "project pages")}, ${plural(totals.raw, "raw note", "raw notes")}.`,
    "",
  ];

  if (pending.length === 0) {
    lines.push("**Pending captures:** none. Every capture is cited by a wiki or project page.");
  } else {
    lines.push(`**Pending captures (${pending.length}):** not yet compiled into a wiki or project page.`);
    for (const c of pending) lines.push(`- ${c.date ?? "undated"} · ${c.title} · \`${c.path}\``);
    lines.push("", "To compile them, follow \"Compiling\" in the vault's AGENTS.md.");
  }
  lines.push("");

  if (broken.length === 0) {
    lines.push("**Broken links:** none.");
  } else {
    lines.push(`**Broken links (${broken.length}):**`);
    for (const b of broken) lines.push(`- \`[[${b.target}]]\` in \`${b.page}\``);
  }
  lines.push("");

  if (log.length === 0) {
    lines.push("**Recent log:** empty.");
  } else {
    lines.push("**Recent log:**");
    for (const e of log) lines.push(`- ${e.date ? `[${e.date}] ` : ""}${e.title}`);
  }
  return `${lines.join("\n")}\n`;
}
