import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SearchIndex, stripMarkdown } from "../src/core/search.js";
import { copyDemoVault, demoVault, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function vaultCopy() {
  const v = await copyDemoVault();
  cleanups.push(v.cleanup);
  return v.path;
}

describe("search", () => {
  it("returns ranked results with path, title, snippet, kind and score", async () => {
    const results = await new SearchIndex(demoVault).search("checkout");
    expect(results.length).toBeGreaterThan(1);
    const first = results[0]!;
    expect(first.path).toBe("wiki/checkout-flow.md");
    expect(first.title).toBe("Checkout flow");
    expect(first.kind).toBe("wiki");
    expect(first.snippet.length).toBeLessThanOrEqual(200);
    expect(first.snippet.toLowerCase()).toContain("checkout");
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("respects the limit", async () => {
    const results = await new SearchIndex(demoVault).search("checkout", 2);
    expect(results).toHaveLength(2);
  });

  it("ignores outputs/ and the vault root files", async () => {
    const vault = await vaultCopy();
    await writeFile(join(vault, "outputs", "answer.md"), "# Answer\n\nzanzibarite appears only here\n");
    await writeFile(join(vault, "index.md"), "zanzibarite in the index\n", { flag: "a" });
    expect(await new SearchIndex(vault).search("zanzibarite")).toEqual([]);
  });

  it("ignores dot-folders", async () => {
    const vault = await vaultCopy();
    await mkdir(join(vault, "wiki", ".obsidian"), { recursive: true });
    await writeFile(join(vault, "wiki", ".obsidian", "x.md"), "zanzibarite\n");
    expect(await new SearchIndex(vault).search("zanzibarite")).toEqual([]);
  });

  it("ranks wiki pages above raw captures for equal matches", async () => {
    const vault = await vaultCopy();
    const text = "Refund rules for yerba subscriptions.\n";
    await writeFile(join(vault, "wiki", "subscription-refunds.md"), `---\ntitle: Notes A\n---\n\n${text}`);
    await writeFile(join(vault, "raw", "inbox", "2026-11-09-subscription-refunds.md"), `---\ntitle: Notes A\n---\n\n${text}`);
    const results = await new SearchIndex(vault).search("yerba subscriptions");
    expect(results.map((r) => r.path).slice(0, 2)).toEqual([
      "wiki/subscription-refunds.md",
      "raw/inbox/2026-11-09-subscription-refunds.md",
    ]);
  });

  it("weighs title matches above body matches", async () => {
    const vault = await vaultCopy();
    await writeFile(join(vault, "wiki", "a.md"), "---\ntitle: Gift cards\n---\n\nHow they work.\n");
    await writeFile(join(vault, "wiki", "b.md"), "---\ntitle: Misc\n---\n\nWe once talked about gift cards in passing, among many other things.\n");
    const results = await new SearchIndex(vault).search("gift cards");
    expect(results[0]!.path).toBe("wiki/a.md");
  });

  it("sees pages added and deleted between calls", async () => {
    const vault = await vaultCopy();
    const index = new SearchIndex(vault);
    expect(await index.search("quokka")).toEqual([]);
    await writeFile(join(vault, "wiki", "quokka.md"), "# Quokka\n\nMascot of the store.\n");
    expect((await index.search("quokka")).map((r) => r.path)).toEqual(["wiki/quokka.md"]);
    await rm(join(vault, "wiki", "quokka.md"));
    expect(await index.search("quokka")).toEqual([]);
  });

  it("sees edits to an existing page", async () => {
    const vault = await vaultCopy();
    const index = new SearchIndex(vault);
    await writeFile(join(vault, "wiki", "edit.md"), "# Edit\n\nfirst version\n");
    expect(await index.search("platypus")).toEqual([]);
    await writeFile(join(vault, "wiki", "edit.md"), "# Edit\n\nsecond version mentions platypus and more\n");
    expect((await index.search("platypus")).map((r) => r.path)).toEqual(["wiki/edit.md"]);
  });

  it("answers in under 200 ms on a 1,000-page vault", async () => {
    const dir = await tempDir();
    cleanups.push(dir.cleanup);
    const words = ["checkout", "coupon", "shipping", "refund", "cart", "payment", "webhook", "invoice", "stock", "yerba"];
    await mkdir(join(dir.path, "wiki"), { recursive: true });
    for (let i = 0; i < 1000; i++) {
      const w = (n: number) => words[(i * 7 + n) % words.length];
      const body = `# Page ${i} about ${w(0)}\n\n${Array.from({ length: 40 }, (_, n) => w(n)).join(" ")}\n`;
      await writeFile(join(dir.path, "wiki", `page-${i}.md`), body);
    }
    const index = new SearchIndex(dir.path);
    await index.refresh();
    const start = performance.now();
    await index.search("coupon refund");
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("stripMarkdown", () => {
  it("removes links, wikilinks, emphasis and headings", () => {
    expect(stripMarkdown("## Title\n**bold** [[a|alias]] [[b]] [text](http://x)")).toBe("Title bold alias b text");
  });
});
