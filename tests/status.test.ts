import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { capture } from "../src/core/capture.js";
import { appendLog } from "../src/core/log.js";
import { SearchIndex } from "../src/core/search.js";
import { formatStatus, vaultStatus } from "../src/core/status.js";
import { initVault } from "../src/core/vault.js";
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
async function tmp() {
  const t = await tempDir();
  cleanups.push(t.cleanup);
  return t.path;
}
const statusOf = (vault: string) => vaultStatus(vault, new SearchIndex(vault));

describe("pending captures", () => {
  it("lists the one capture no page cites, with path, title and date", async () => {
    const status = await statusOf(await vaultCopy());
    expect(status.pending).toEqual([
      {
        path: "raw/inbox/2026-11-08-shipping-cost-rounding.md",
        title: "Shipping cost rounding differs between cart and checkout",
        date: "2026-11-08",
        captured_at: "2026-11-08T18:03:44-03:00",
      },
    ]);
  });

  it("is empty when every capture is cited, by path or by file name", async () => {
    const vault = await vaultCopy();
    await writeFile(
      join(vault, "wiki", "shipping.md"),
      "---\ntitle: Shipping\nsources:\n  - 2026-11-08-shipping-cost-rounding\n---\n\n# Shipping\n",
    );
    expect((await statusOf(vault)).pending).toEqual([]);
  });

  it("accepts sources as a single string, with Windows separators or wikilink brackets", async () => {
    for (const source of [
      "raw/inbox/2026-11-08-shipping-cost-rounding.md",
      "raw\\inbox\\2026-11-08-shipping-cost-rounding.md",
      "'[[2026-11-08-shipping-cost-rounding]]'",
    ]) {
      const vault = await vaultCopy();
      await writeFile(join(vault, "projects", "storefront", "shipping.md"), `---\ntitle: Shipping\nsources: ${source}\n---\n\nBody\n`);
      expect((await statusOf(vault)).pending, source).toEqual([]);
    }
  });

  it("ignores citations from raw notes and outputs", async () => {
    const vault = await vaultCopy();
    await writeFile(
      join(vault, "outputs", "answer.md"),
      "---\nsources: [raw/inbox/2026-11-08-shipping-cost-rounding.md]\n---\n\nAnswer\n",
    );
    expect((await statusOf(vault)).pending.map((c) => c.path)).toEqual(["raw/inbox/2026-11-08-shipping-cost-rounding.md"]);
  });

  it("lists pending captures oldest first", async () => {
    const vault = await vaultCopy();
    const cwd = await tmp();
    await capture(vault, { text: "later", title: "Later note" }, { now: new Date(2026, 10, 9, 18, 0), cwd });
    await capture(vault, { text: "earlier", title: "Earlier note" }, { now: new Date(2026, 10, 9, 9, 0), cwd });
    expect((await statusOf(vault)).pending.map((c) => c.title)).toEqual([
      "Shipping cost rounding differs between cart and checkout",
      "Earlier note",
      "Later note",
    ]);
  });
});

describe("broken links", () => {
  it("reports a link to a page that does not exist, and not an alias link to one that does", async () => {
    const status = await statusOf(await vaultCopy());
    expect(status.broken_links).toEqual([{ page: "wiki/checkout-flow.md", target: "refund-policy" }]);
  });

  it("matches targets by file name, case-insensitive, anywhere in the vault", async () => {
    const vault = await vaultCopy();
    await writeFile(
      join(vault, "wiki", "links.md"),
      [
        "# Links",
        "[[Checkout-Flow]] [[wiki/payments-glossary]] [[checkout-flow#Known traps]] [[checkout-flow.md]]",
        "[[index]] [[notes]] [[2026-11-08-shipping-cost-rounding]] [[incident-2026-10-coupon-applied-twice|the incident]]",
        "| table | [[payments-glossary\\|glossary]] |",
        "![[diagram.png]] [[#Same page heading]]",
        "",
      ].join("\n"),
    );
    expect((await statusOf(vault)).broken_links.filter((b) => b.page === "wiki/links.md")).toEqual([]);
  });

  it("ignores links in code and in raw notes, and reports each target once per page", async () => {
    const vault = await vaultCopy();
    await writeFile(
      join(vault, "projects", "storefront", "code.md"),
      "# Code\n\n```md\n[[inside-fence]]\n```\n\n`[[inline-code]]`\n\n[[gift-cards]] and again [[gift-cards]]\n",
    );
    await writeFile(join(vault, "raw", "inbox", "2026-11-09-raw.md"), "[[nowhere]]\n");
    expect((await statusOf(vault)).broken_links).toEqual([
      { page: "projects/storefront/code.md", target: "gift-cards" },
      { page: "wiki/checkout-flow.md", target: "refund-policy" },
    ]);
  });

  it("clears once the page is created", async () => {
    const vault = await vaultCopy();
    const index = new SearchIndex(vault);
    expect((await vaultStatus(vault, index)).broken_links).toHaveLength(1);
    await mkdir(join(vault, "wiki", "policies"), { recursive: true });
    await writeFile(join(vault, "wiki", "policies", "refund-policy.md"), "# Refund policy\n");
    expect((await vaultStatus(vault, index)).broken_links).toEqual([]);
  });
});

describe("recent log and totals", () => {
  it("returns the last five log entries, newest first", async () => {
    const vault = await vaultCopy();
    await appendLog(vault, "## [2026-11-09] compile | wiki/payments-glossary.md");
    await appendLog(vault, "## [2026-11-10] review | wiki/checkout-flow.md");
    const { recent_log } = await statusOf(vault);
    expect(recent_log.map((e) => `${e.date} ${e.title}`)).toEqual([
      "2026-11-10 review | wiki/checkout-flow.md",
      "2026-11-09 compile | wiki/payments-glossary.md",
      "2026-11-08 capture | Shipping cost rounding differs between cart and checkout",
      "2026-11-04 compile | wiki/checkout-flow.md",
      "2026-11-03 capture | Checkout timeout in the payment sandbox",
    ]);
    expect(recent_log[2]!.details).toBe("raw/inbox/2026-11-08-shipping-cost-rounding.md");
  });

  it("counts pages per folder", async () => {
    expect((await statusOf(demoVault)).totals).toEqual({ wiki: 3, projects: 1, raw: 3 });
  });

  it("reports a just-created vault as empty, with the init entry", async () => {
    const vault = join(await tmp(), "vault");
    await initVault(vault, new Date(2026, 10, 9));
    const status = await statusOf(vault);
    expect(status).toEqual({
      pending: [],
      broken_links: [],
      recent_log: [{ date: "2026-11-09", title: "init", details: "" }],
      totals: { wiki: 0, projects: 0, raw: 0 },
    });
    expect(formatStatus(status)).toContain("**Pending captures:** none.");
  });

  it("works on a vault whose log has no entries", async () => {
    const vault = await vaultCopy();
    await writeFile(join(vault, "log.md"), "# Log\n");
    const status = await statusOf(vault);
    expect(status.recent_log).toEqual([]);
    expect(formatStatus(status)).toContain("**Recent log:** empty.");
  });
});

describe("status", () => {
  it("shows a new capture as pending and its log entry first", async () => {
    const vault = await vaultCopy();
    const index = new SearchIndex(vault);
    await vaultStatus(vault, index);
    const result = await capture(vault, { text: "Gift cards can't pay shipping.", title: "Gift cards and shipping" }, { now: new Date(2026, 10, 9), cwd: await tmp() });
    const status = await vaultStatus(vault, index);
    expect(status.pending.map((c) => c.path)).toContain(result.path);
    expect(status.recent_log[0]).toMatchObject({ title: "capture | Gift cards and shipping", details: result.path });
    expect(status.totals.raw).toBe(4);
  });

  it("returns identical results when nothing changed", async () => {
    const vault = await vaultCopy();
    const index = new SearchIndex(vault);
    const first = await vaultStatus(vault, index);
    const second = await vaultStatus(vault, index);
    const fresh = await statusOf(vault);
    expect(second).toEqual(first);
    expect(fresh).toEqual(first);
    expect(formatStatus(second)).toBe(formatStatus(first));
  });

  it("summarizes the example vault in markdown", async () => {
    await expect(formatStatus(await statusOf(demoVault))).toMatchFileSnapshot("__snapshots__/status-demo-vault.md");
  });
});
