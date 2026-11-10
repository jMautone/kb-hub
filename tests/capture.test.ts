import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { capture, CaptureError, deriveTitle, isoWithOffset, slugify } from "../src/core/capture.js";
import { appendLog, parseLog, recentLog } from "../src/core/log.js";
import { parsePage } from "../src/core/pages.js";
import { git, makeRepo, copyDemoVault, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function vaultCopy() {
  const v = await copyDemoVault();
  cleanups.push(v.cleanup);
  return v.path;
}
async function tmp() {
  const t = await tempDir();
  cleanups.push(t.cleanup);
  return t.path;
}

const NOV_9 = new Date(2026, 10, 9, 14, 30, 5);
const TITLE = "Checkout fails with expired coupon";
const TEXT = "Expired coupons are only checked in the cart, so checkout accepts them. Validate again on POST /checkout.";

async function readNote(vault: string, rel: string) {
  return parsePage(rel, await readFile(join(vault, ...rel.split("/")), "utf8"));
}

describe("capture", () => {
  it("writes a new inbox note named after the date and title", async () => {
    const vault = await vaultCopy();
    const result = await capture(vault, { text: TEXT, title: TITLE, tags: ["checkout", "coupons"] }, { now: NOV_9, cwd: await tmp() });
    expect(result.path).toBe("raw/inbox/2026-11-09-checkout-fails-with-expired-coupon.md");
    const note = await readNote(vault, result.path);
    expect(note.body).toBe(`${TEXT}\n`);
    expect(note.frontmatter.title).toBe(TITLE);
    expect(note.frontmatter.tags).toEqual(["checkout", "coupons"]);
    expect(note.frontmatter.captured_at).toBe(isoWithOffset(NOV_9));
  });

  it("takes the slug from the first words of the text when there is no title", async () => {
    const vault = await vaultCopy();
    const result = await capture(vault, { text: "## Stock sync\n\nThe nightly stock sync skips products with a dash in the SKU." }, { now: NOV_9, cwd: await tmp() });
    expect(result.title).toBe("Stock sync");
    expect(result.path).toBe("raw/inbox/2026-11-09-stock-sync.md");
  });

  it("adds a numeric suffix on a name collision and leaves the existing file alone", async () => {
    const vault = await vaultCopy();
    const existing = join(vault, "raw", "inbox", "2026-11-09-checkout-fails-with-expired-coupon.md");
    await writeFile(existing, "original\n");
    const cwd = await tmp();
    const second = await capture(vault, { text: TEXT, title: TITLE }, { now: NOV_9, cwd });
    const third = await capture(vault, { text: TEXT, title: TITLE }, { now: NOV_9, cwd });
    expect(second.path).toBe("raw/inbox/2026-11-09-checkout-fails-with-expired-coupon-2.md");
    expect(third.path).toBe("raw/inbox/2026-11-09-checkout-fails-with-expired-coupon-3.md");
    expect(await readFile(existing, "utf8")).toBe("original\n");
  });

  it("gives concurrent captures with the same title different files", async () => {
    const vault = await vaultCopy();
    const cwd = await tmp();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => capture(vault, { text: `note ${i}`, title: TITLE }, { now: NOV_9, cwd })),
    );
    expect(new Set(results.map((r) => r.path)).size).toBe(5);
    for (const [i, r] of results.entries()) expect((await readNote(vault, r.path)).body).toBe(`note ${i}\n`);
  });

  it("leaves no temp files behind", async () => {
    const vault = await vaultCopy();
    await capture(vault, { text: TEXT, title: TITLE }, { now: NOV_9, cwd: await tmp() });
    const names = await readdir(join(vault, "raw", "inbox"));
    expect(names.filter((n) => !n.endsWith(".md"))).toEqual([]);
  });

  it.each(["", "   ", "\n\t\n"])("rejects empty text %j and writes nothing", async (text) => {
    const vault = await vaultCopy();
    const before = await readdir(join(vault, "raw", "inbox"));
    const log = await readFile(join(vault, "log.md"), "utf8");
    await expect(capture(vault, { text }, { now: NOV_9 })).rejects.toThrow(CaptureError);
    await expect(capture(vault, { text }, { now: NOV_9 })).rejects.toThrow(/text/);
    expect(await readdir(join(vault, "raw", "inbox"))).toEqual(before);
    expect(await readFile(join(vault, "log.md"), "utf8")).toBe(log);
  });

  it("rejects a cwd that is not a folder and writes nothing", async () => {
    const vault = await vaultCopy();
    const before = await readdir(join(vault, "raw", "inbox"));
    await expect(capture(vault, { text: TEXT, cwd: join(await tmp(), "missing") })).rejects.toThrow(/cwd/);
    expect(await readdir(join(vault, "raw", "inbox"))).toEqual(before);
  });

  it("normalizes CRLF text to LF", async () => {
    const vault = await vaultCopy();
    const result = await capture(vault, { text: "line one\r\nline two\r\n", title: "Windows note" }, { now: NOV_9, cwd: await tmp() });
    const raw = await readFile(join(vault, ...result.path.split("/")), "utf8");
    expect(raw).not.toContain("\r");
    expect(raw.endsWith("line one\nline two\n")).toBe(true);
  });

  it("keeps any title and tags intact through YAML", async () => {
    const vault = await vaultCopy();
    const titles = [
      "Incident 2026-10: coupon applied twice",
      'Quotes "double" and \'single\'',
      "yes",
      "123",
      "# not a comment",
      "Señal de pago rechazada",
      "a: b #c [d] {e} & *f !g | >h %i @j `k`",
    ];
    for (const title of titles) {
      const tags = ["two words", "with,comma", "#hash", "null", "ok"];
      const result = await capture(vault, { text: "body", title, tags }, { now: NOV_9, cwd: await tmp() });
      const note = await readNote(vault, result.path);
      expect(note.frontmatter.title, title).toBe(title);
      expect(note.frontmatter.tags).toEqual(["two-words", "with,comma", "hash", "null", "ok"]);
    }
  });

  it("collapses a multi-line title to one line", async () => {
    const vault = await vaultCopy();
    const result = await capture(vault, { text: TEXT, title: "First line\nsecond line" }, { now: NOV_9, cwd: await tmp() });
    expect(result.title).toBe("First line second line");
  });
});

describe("capture provenance", () => {
  it("records repo, branch, commit and work item from cwd", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(join(await tmp(), "storefront"), {
      branch: "feature/4821-checkout",
      origin: "git@github.com:mate-and-co/storefront.git",
    });
    const commit = await git(repo, ["rev-parse", "--short", "HEAD"]);
    const result = await capture(vault, { text: TEXT, title: TITLE, cwd: repo }, { now: NOV_9 });
    const note = await readNote(vault, result.path);
    expect(note.frontmatter.provenance).toEqual({
      repo: "mate-and-co/storefront",
      branch: "feature/4821-checkout",
      commit,
      work_item: "4821",
    });
    const raw = await readFile(join(vault, ...result.path.split("/")), "utf8");
    expect(raw).toContain('  work_item: "4821"\n');
  });

  it("uses the server's working directory when cwd is not given", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(join(await tmp(), "storefront"), { branch: "bugfix/77-null-cart" });
    const result = await capture(vault, { text: TEXT }, { now: NOV_9, cwd: repo });
    expect(result.provenance).toMatchObject({ repo: "storefront", branch: "bugfix/77-null-cart", work_item: "77" });
  });

  it("resolves a relative cwd against the server's working directory", async () => {
    const vault = await vaultCopy();
    const parent = await tmp();
    await makeRepo(join(parent, "storefront"), { branch: "main" });
    const result = await capture(vault, { text: TEXT, cwd: "storefront" }, { now: NOV_9, cwd: parent });
    expect(result.provenance.repo).toBe("storefront");
  });

  it("still writes the note outside a git repo, with null provenance", async () => {
    const vault = await vaultCopy();
    const result = await capture(vault, { text: TEXT, title: TITLE }, { now: NOV_9, cwd: await tmp() });
    const note = await readNote(vault, result.path);
    expect(note.frontmatter.provenance).toEqual({ repo: null, branch: null, commit: null, work_item: null });
  });

  it("never stores credentials from the remote URL", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(await tmp(), {
      branch: "main",
      origin: "https://user:s3cret@dev.azure.com/contoso/Shop/_git/storefront",
    });
    const result = await capture(vault, { text: TEXT, cwd: repo }, { now: NOV_9 });
    const raw = await readFile(join(vault, ...result.path.split("/")), "utf8");
    expect(result.provenance.repo).toBe("contoso/Shop/storefront");
    expect(raw).not.toMatch(/user@|s3cret/);
  });
});

describe("capture log", () => {
  it("appends one entry with the title and path, keeping earlier entries byte for byte", async () => {
    const vault = await vaultCopy();
    const before = await readFile(join(vault, "log.md"), "utf8");
    const result = await capture(vault, { text: TEXT, title: TITLE }, { now: NOV_9, cwd: await tmp() });
    const after = await readFile(join(vault, "log.md"), "utf8");
    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(before.length)).toBe(`\n## [2026-11-09] capture | ${TITLE}\n${result.path}\n`);
    const [last] = await recentLog(vault, 1);
    expect(last).toEqual({ date: "2026-11-09", title: `capture | ${TITLE}`, details: result.path });
  });
});

describe("appendLog", () => {
  it("separates entries with a blank line even when the file lacks a final newline", async () => {
    const dir = await tmp();
    await writeFile(join(dir, "log.md"), "# Log\n\n## [2026-11-01] init");
    await appendLog(dir, "## [2026-11-02] capture | A\nraw/inbox/a.md");
    expect(await readFile(join(dir, "log.md"), "utf8")).toBe("# Log\n\n## [2026-11-01] init\n\n## [2026-11-02] capture | A\nraw/inbox/a.md\n");
  });

  it("creates log.md when it is missing", async () => {
    const dir = await tmp();
    await appendLog(dir, "## [2026-11-02] init");
    expect(existsSync(join(dir, "log.md"))).toBe(true);
    expect(await readFile(join(dir, "log.md"), "utf8")).toBe("## [2026-11-02] init\n");
  });

  it("parses entries with and without details, CRLF included", () => {
    const entries = parseLog("# Log\r\n\r\nintro\r\n\r\n## [2026-11-01] init\r\n\r\n## [2026-11-02] capture | A\r\nraw/inbox/a.md\r\n\r\n## free heading\r\n");
    expect(entries).toEqual([
      { date: "2026-11-01", title: "init", details: "" },
      { date: "2026-11-02", title: "capture | A", details: "raw/inbox/a.md" },
      { date: null, title: "free heading", details: "" },
    ]);
  });
});

describe("helpers", () => {
  it("slugs titles to ASCII kebab-case", () => {
    expect(slugify("Checkout fails with expired coupon")).toBe("checkout-fails-with-expired-coupon");
    expect(slugify("Señal de pago: ¿rechazada?")).toBe("senal-de-pago-rechazada");
    expect(slugify("🧉🧉")).toBe("");
  });

  it("caps slugs at 60 characters on a word boundary", () => {
    const slug = slugify("The payment provider sandbox answers slowly on Mondays and timeouts there are not bugs");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("the-payment-provider-sandbox-answers-slowly-on-mondays-and");
  });

  it("derives a short title from the first line with text", () => {
    expect(deriveTitle("\n\n- **Coupons** are applied once\nmore")).toBe("Coupons are applied once");
    expect(deriveTitle("one two three four five six seven eight nine ten")).toBe("one two three four five six seven eight…");
    expect(deriveTitle("```\n```")).toBe("Capture");
  });

  it("formats local time with the UTC offset", () => {
    expect(isoWithOffset(NOV_9)).toMatch(/^2026-11-09T14:30:05[+-]\d{2}:\d{2}$/);
  });
});
