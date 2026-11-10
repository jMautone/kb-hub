import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { capture, CaptureError, isoWithOffset, slugify } from "../src/core/capture.js";
import { parsePage } from "../src/core/pages.js";
import { copyDemoVault, makeGitRepo, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function setup() {
  const vault = await copyDemoVault();
  cleanups.push(vault.cleanup);
  const repo = await tempDir("kb-hub-repo-");
  cleanups.push(repo.cleanup);
  const sha = makeGitRepo(repo.path, "feature/4821-checkout", "git@github.com:mate-and-co/storefront.git");
  return { vault: vault.path, repo: repo.path, sha };
}
const NOW = new Date(2026, 10, 9, 16, 42, 10);

describe("capture", () => {
  it("writes a dated note named after the title", async () => {
    const { vault, repo } = await setup();
    const result = await capture(vault, { text: "Expired coupons crash checkout.", title: "Checkout fails with expired coupon", cwd: repo }, NOW);
    expect(result.path).toBe("raw/inbox/2026-11-09-checkout-fails-with-expired-coupon.md");
    const page = parsePage(result.path, await readFile(join(vault, result.path), "utf8"));
    expect(page.body.trim()).toBe("Expired coupons crash checkout.");
    expect(page.frontmatter.title).toBe("Checkout fails with expired coupon");
  });

  it("records provenance from the repo", async () => {
    const { vault, repo, sha } = await setup();
    const result = await capture(vault, { text: "note", title: "Provenance", tags: ["checkout"], cwd: repo }, NOW);
    const page = parsePage(result.path, await readFile(join(vault, result.path), "utf8"));
    expect(page.frontmatter.provenance).toEqual({
      repo: "mate-and-co/storefront",
      branch: "feature/4821-checkout",
      commit: sha,
      work_item: "4821",
    });
    expect(page.frontmatter.tags).toEqual(["checkout"]);
    expect(String(result.captured_at)).toBe(isoWithOffset(NOW));
    expect(result.captured_at).toMatch(/^2026-11-09T16:42:10[+-]\d{2}:\d{2}$/);
  });

  it("still writes the note outside a git repo, with null provenance", async () => {
    const { vault } = await setup();
    const outside = await tempDir();
    cleanups.push(outside.cleanup);
    const result = await capture(vault, { text: "no repo here", cwd: outside.path }, NOW);
    expect(result.provenance).toEqual({ repo: null, branch: null, commit: null, work_item: null });
    const raw = await readFile(join(vault, result.path), "utf8");
    expect(raw).toContain("work_item: null");
  });

  it("derives the title from the text when none is given", async () => {
    const { vault, repo } = await setup();
    const result = await capture(vault, { text: "Shipping rounding uses half-even in checkout only", cwd: repo }, NOW);
    expect(result.path).toBe("raw/inbox/2026-11-09-shipping-rounding-uses-half-even-in-checkout-only.md");
  });

  it("adds a numeric suffix instead of overwriting", async () => {
    const { vault, repo } = await setup();
    const a = await capture(vault, { text: "first", title: "Same title", cwd: repo }, NOW);
    const b = await capture(vault, { text: "second", title: "Same title", cwd: repo }, NOW);
    const c = await capture(vault, { text: "third", title: "Same title", cwd: repo }, NOW);
    expect([a.path, b.path, c.path]).toEqual([
      "raw/inbox/2026-11-09-same-title.md",
      "raw/inbox/2026-11-09-same-title-2.md",
      "raw/inbox/2026-11-09-same-title-3.md",
    ]);
    expect(await readFile(join(vault, a.path), "utf8")).toContain("first");
  });

  it("rejects empty text and writes nothing", async () => {
    const { vault, repo } = await setup();
    const before = await readdir(join(vault, "raw", "inbox"));
    await expect(capture(vault, { text: "   \n ", cwd: repo }, NOW)).rejects.toThrow(CaptureError);
    expect(await readdir(join(vault, "raw", "inbox"))).toEqual(before);
  });

  it("appends a log entry and keeps earlier ones", async () => {
    const { vault, repo } = await setup();
    const before = await readFile(join(vault, "log.md"), "utf8");
    const result = await capture(vault, { text: "x", title: "Checkout fails with expired coupon", cwd: repo }, NOW);
    const after = await readFile(join(vault, "log.md"), "utf8");
    expect(after.startsWith(before)).toBe(true);
    expect(after.trimEnd().split("\n").slice(-2)).toEqual([
      "## [2026-11-09] capture | Checkout fails with expired coupon",
      result.path,
    ]);
  });

  it("keeps titles with quotes and colons valid in YAML", async () => {
    const { vault, repo } = await setup();
    const title = 'Error: "coupon" not found: #4821';
    const result = await capture(vault, { text: "x", title, cwd: repo }, NOW);
    const page = parsePage(result.path, await readFile(join(vault, result.path), "utf8"));
    expect(page.frontmatter.title).toBe(title);
  });

  it("rejects a cwd that does not exist", async () => {
    const { vault } = await setup();
    await expect(capture(vault, { text: "x", cwd: join(vault, "nope") }, NOW)).rejects.toThrow(/not an existing folder/);
  });

  it("normalizes CRLF text", async () => {
    const { vault, repo } = await setup();
    const result = await capture(vault, { text: "line one\r\nline two", cwd: repo }, NOW);
    expect(await readFile(join(vault, result.path), "utf8")).not.toContain("\r");
  });
});

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("Facturación: ¿qué pasó con el cupón?")).toBe("facturacion-que-paso-con-el-cupon");
    expect(slugify("!!!")).toBe("note");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });
});

describe("demo vault is untouched", () => {
  it("tests write to copies only", async () => {
    const { vault } = await setup();
    await writeFile(join(vault, "log.md"), "changed");
    const original = await readFile(join(import.meta.dirname, "..", "examples", "demo-vault", "log.md"), "utf8");
    expect(original).not.toBe("changed");
  });
});
