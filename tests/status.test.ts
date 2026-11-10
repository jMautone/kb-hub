import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatStatus, recentLog, vaultStatus } from "../src/core/status.js";
import { copyDemoVault, demoVault } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function vaultCopy() {
  const v = await copyDemoVault();
  cleanups.push(v.cleanup);
  return v.path;
}

describe("status", () => {
  it("lists only the capture no page cites", async () => {
    const s = await vaultStatus(demoVault);
    expect(s.pending.map((p) => p.path)).toEqual(["raw/inbox/2026-11-08-shipping-cost-rounding.md"]);
    expect(s.pending[0]!.title).toBe("Shipping cost rounding differs between cart and checkout");
  });

  it("reports nothing pending once every capture is cited, by path or by name", async () => {
    const vault = await vaultCopy();
    await writeFile(
      join(vault, "wiki", "shipping.md"),
      "---\ntitle: Shipping\nsources:\n  - \"[[2026-11-08-shipping-cost-rounding]]\"\n---\n\n# Shipping\n",
    );
    expect((await vaultStatus(vault)).pending).toEqual([]);
  });

  it("lists pending captures oldest first", async () => {
    const vault = await vaultCopy();
    await writeFile(join(vault, "raw", "inbox", "2026-01-01-old.md"), "---\ntitle: Old\ncaptured_at: 2026-01-01T10:00:00-03:00\n---\n\nold\n");
    const s = await vaultStatus(vault);
    expect(s.pending.map((p) => p.path)).toEqual([
      "raw/inbox/2026-01-01-old.md",
      "raw/inbox/2026-11-08-shipping-cost-rounding.md",
    ]);
  });

  it("finds broken wikilinks and accepts aliases to existing pages", async () => {
    const s = await vaultStatus(demoVault);
    expect(s.broken_links).toEqual([{ target: "refund-policy", page: "wiki/checkout-flow.md" }]);
  });

  it("ignores links inside code blocks and matches names case-insensitively", async () => {
    const vault = await vaultCopy();
    await writeFile(join(vault, "wiki", "x.md"), "# X\n\n[[Checkout-Flow]] and [[checkout-flow#Known traps|traps]]\n\n```\n[[not-a-link]]\n```\n");
    const s = await vaultStatus(vault);
    expect(s.broken_links.map((b) => b.target)).toEqual(["refund-policy"]);
  });

  it("returns the last five log entries, newest first, and page counts", async () => {
    const s = await vaultStatus(demoVault);
    expect(s.recent_log).toHaveLength(5);
    expect(s.recent_log[0]).toMatch(/^## \[2026-11-08\] capture/);
    expect(s.counts).toEqual({ wiki: 3, projects: 1, raw: 3 });
  });

  it("is deterministic", async () => {
    expect(await vaultStatus(demoVault)).toEqual(await vaultStatus(demoVault));
  });

  it("formats a readable summary", async () => {
    const text = formatStatus(await vaultStatus(demoVault));
    expect(text).toContain("Pending captures (1)");
    expect(text).toContain("[[refund-policy]] in wiki/checkout-flow.md");
  });
});

describe("recentLog", () => {
  it("handles CRLF and multi-line entries", () => {
    const log = "# Log\r\n\r\n## [2026-01-01] init\r\n\r\n## [2026-01-02] capture | A\r\nraw/inbox/a.md\r\n";
    expect(recentLog(log)).toEqual(["## [2026-01-02] capture | A\nraw/inbox/a.md", "## [2026-01-01] init"]);
  });
});
