import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPage, parsePage } from "../src/core/pages.js";
import { PathError, resolveInVault } from "../src/core/paths.js";
import { copyDemoVault, demoVault, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof PathError ? err.code : "other";
  }
  return undefined;
}

describe("resolveInVault", () => {
  it("accepts vault-relative paths with either separator", () => {
    expect(resolveInVault(demoVault, "wiki/checkout-flow.md")).toBe(join(demoVault, "wiki", "checkout-flow.md"));
    expect(resolveInVault(demoVault, "wiki\\checkout-flow.md")).toBe(join(demoVault, "wiki", "checkout-flow.md"));
  });

  it("rejects traversal outside the vault", () => {
    expect(codeOf(() => resolveInVault(demoVault, "../secrets.md"))).toBe("outside");
    expect(codeOf(() => resolveInVault(demoVault, "wiki/../../secrets.md"))).toBe("outside");
    expect(codeOf(() => resolveInVault(demoVault, "wiki\\..\\..\\secrets.md"))).toBe("outside");
  });

  it("rejects absolute POSIX and Windows paths", () => {
    expect(codeOf(() => resolveInVault(demoVault, "/etc/passwd"))).toBe("absolute");
    expect(codeOf(() => resolveInVault(demoVault, "C:\\Windows\\win.ini"))).toBe("absolute");
    expect(codeOf(() => resolveInVault(demoVault, "C:/Windows/win.ini"))).toBe("absolute");
    expect(codeOf(() => resolveInVault(demoVault, "\\\\server\\share\\x.md"))).toBe("absolute");
  });

  it("rejects a link that points outside the vault", async () => {
    const vault = await copyDemoVault();
    cleanups.push(vault.cleanup);
    const outside = await tempDir("kb-hub-outside-");
    cleanups.push(outside.cleanup);
    await writeFile(join(outside.path, "secret.md"), "# Secret\n");
    // A junction works on Windows without admin rights; on macOS and Linux the type is ignored.
    await symlink(outside.path, join(vault.path, "wiki", "escape"), "junction");
    expect(codeOf(() => resolveInVault(vault.path, "wiki/escape/secret.md"))).toBe("outside");
  });
});

describe("loadPage", () => {
  it("returns frontmatter and body without the frontmatter block", async () => {
    const page = await loadPage(demoVault, "wiki/checkout-flow.md");
    expect(page.title).toBe("Checkout flow");
    expect(page.frontmatter.tags).toEqual(["checkout", "payments", "coupons"]);
    expect(page.frontmatter.updated).toBe("2026-11-04");
    expect(page.body.startsWith("# Checkout flow")).toBe(true);
    expect(page.body).not.toContain("sources:");
  });

  it("serves a page without frontmatter as all body", () => {
    const page = parsePage("wiki/plain.md", "# Plain page\n\nJust text.\n");
    expect(page.frontmatter).toEqual({});
    expect(page.body).toBe("# Plain page\n\nJust text.\n");
    expect(page.title).toBe("Plain page");
  });

  it("falls back to the file name for the title", () => {
    expect(parsePage("wiki/no-heading.md", "text only").title).toBe("no-heading");
  });

  it("parses pages saved with CRLF line endings", () => {
    const page = parsePage("wiki/win.md", "---\r\ntitle: Windows page\r\ntags: [a]\r\n---\r\n\r\n# Heading\r\nBody\r\n");
    expect(page.title).toBe("Windows page");
    expect(page.frontmatter.tags).toEqual(["a"]);
    expect(page.body).not.toContain("\r");
  });

  it("suggests close paths for a typo", async () => {
    const err = await loadPage(demoVault, "wiki/chekout-flow.md").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PathError);
    expect((err as PathError).code).toBe("not-found");
    expect((err as PathError).message).toContain("wiki/checkout-flow.md");
  });

  it("only reads markdown files", async () => {
    const vault = await copyDemoVault();
    cleanups.push(vault.cleanup);
    await mkdir(join(vault.path, "outputs"), { recursive: true });
    await writeFile(join(vault.path, "outputs", "diagram.png"), "png");
    const err = await loadPage(vault.path, "outputs/diagram.png").catch((e: unknown) => e);
    expect((err as PathError).code).toBe("not-markdown");
  });
});
