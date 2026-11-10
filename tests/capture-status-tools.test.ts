import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";
import { cliPath, copyDemoVault, git, makeRepo, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function tmp() {
  const t = await tempDir();
  cleanups.push(t.cleanup);
  return t.path;
}
async function vaultCopy() {
  const v = await copyDemoVault();
  cleanups.push(v.cleanup);
  return v.path;
}

/** Starts the server the way Claude Code does: as a child process whose working directory is the project. */
async function connect(vault: string, cwd: string, env: Record<string, string> = {}): Promise<Client> {
  const client = new Client({ name: "kb-hub-test", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [cliPath, "mcp", "--vault", vault],
      cwd,
      env: { ...(process.env as Record<string, string>), ...env },
      stderr: "pipe",
    }),
  );
  cleanups.push(() => client.close());
  return client;
}

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }>; structuredContent?: unknown };

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    return (await client.callTool({ name, arguments: args })) as ToolResult;
  } catch (err) {
    // Some SDK versions reject invalid input with a protocol error instead of an error result.
    return { isError: true, content: [{ type: "text", text: String(err) }] };
  }
}
const text = (r: ToolResult) => r.content.map((c) => c.text).join("\n");

type Captured = { path: string; provenance: Record<string, string | null> };

describe("capture tool", () => {
  it("is listed with status", async () => {
    const client = await connect(await vaultCopy(), await tmp());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(["capture", "status"]));
  });

  it("takes provenance from the repo the server was started in", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(join(await tmp(), "storefront"), {
      branch: "feature/4821-checkout",
      origin: "git@github.com:mate-and-co/storefront.git",
    });
    const commit = await git(repo, ["rev-parse", "--short", "HEAD"]);
    const client = await connect(vault, repo);
    const result = await call(client, "capture", { text: "Expired coupons pass checkout.", title: "Checkout fails with expired coupon" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as Captured;
    expect(data.path).toMatch(/^raw\/inbox\/\d{4}-\d{2}-\d{2}-checkout-fails-with-expired-coupon\.md$/);
    expect(data.provenance).toEqual({ repo: "mate-and-co/storefront", branch: "feature/4821-checkout", commit, work_item: "4821" });
    expect(text(result)).toContain("work item 4821");
    expect((result.structuredContent as { message: string }).message).toContain("work item 4821");

    const note = await readFile(join(vault, ...data.path.split("/")), "utf8");
    expect(note).toContain("repo: mate-and-co/storefront");
    const log = await readFile(join(vault, "log.md"), "utf8");
    expect(log.trimEnd().endsWith(`capture | Checkout fails with expired coupon\n${data.path}`)).toBe(true);
  });

  it("takes provenance from cwd when given", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(await tmp(), { branch: "bugfix/77-null-cart", origin: "https://dev.azure.com/contoso/Shop/_git/storefront" });
    const client = await connect(vault, await tmp());
    const result = await call(client, "capture", { text: "Null cart on reload.", cwd: repo });
    expect((result.structuredContent as Captured).provenance).toMatchObject({ repo: "contoso/Shop/storefront", work_item: "77" });
  });

  it("says so when there is no repo, and still saves the note", async () => {
    const vault = await vaultCopy();
    const client = await connect(vault, await tmp());
    const result = await call(client, "capture", { text: "Outside any repo." });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as Captured).provenance).toEqual({ repo: null, branch: null, commit: null, work_item: null });
    expect(text(result)).toMatch(/cwd/);
    expect((result.structuredContent as { message: string }).message).toMatch(/cwd/);
  });

  it("uses KB_WORKITEM_PATTERN", async () => {
    const vault = await vaultCopy();
    const repo = await makeRepo(await tmp(), { branch: "feature/PROJ-123-checkout" });
    const client = await connect(vault, repo, { KB_WORKITEM_PATTERN: "([A-Z]+-\\d+)" });
    const result = await call(client, "capture", { text: "Custom pattern." });
    expect((result.structuredContent as Captured).provenance.work_item).toBe("PROJ-123");
  });

  it("rejects empty text, naming the field, and writes nothing", async () => {
    const vault = await vaultCopy();
    const before = await readdir(join(vault, "raw", "inbox"));
    const client = await connect(vault, await tmp());
    const result = await call(client, "capture", { text: "   " });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/text/);
    expect(await readdir(join(vault, "raw", "inbox"))).toEqual(before);
  });

  it("rejects a cwd that does not exist", async () => {
    const vault = await vaultCopy();
    const client = await connect(vault, await tmp());
    const result = await call(client, "capture", { text: "Note.", cwd: join(await tmp(), "missing") });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/cwd/);
  });
});

describe("status tool", () => {
  it("returns the structured status and a markdown summary", async () => {
    const vault = await vaultCopy();
    const client = await connect(vault, await tmp());
    const result = await call(client, "status", {});
    const data = result.structuredContent as { pending: Array<{ path: string }>; broken_links: unknown[]; totals: unknown };
    expect(data.pending.map((c) => c.path)).toEqual(["raw/inbox/2026-11-08-shipping-cost-rounding.md"]);
    expect(data.broken_links).toEqual([{ page: "wiki/checkout-flow.md", target: "refund-policy" }]);
    expect(data.totals).toEqual({ wiki: 3, projects: 1, raw: 3 });
    expect(text(result)).toContain("**Pending captures (1):**");
    expect((result.structuredContent as { summary: string }).summary).toBe(text(result));
  });

  it("sees a capture made in the same session", async () => {
    const vault = await vaultCopy();
    const client = await connect(vault, await tmp());
    await call(client, "status", {});
    const captured = (await call(client, "capture", { text: "Gift cards can't pay shipping.", title: "Gift cards and shipping" }))
      .structuredContent as Captured;
    const result = await call(client, "status", {});
    expect((result.structuredContent as { pending: Array<{ path: string }> }).pending.map((c) => c.path)).toContain(captured.path);
    const search = await call(client, "search", { query: "gift cards shipping" });
    expect((search.structuredContent as { results: Array<{ path: string }> }).results[0]?.path).toBe(captured.path);
  });
});

describe("server configuration", () => {
  it("exits with an error when KB_WORKITEM_PATTERN is not a valid regex", async () => {
    const vault = await vaultCopy();
    const res = spawnSync(process.execPath, [cliPath, "mcp", "--vault", vault], {
      encoding: "utf8",
      env: { ...process.env, KB_WORKITEM_PATTERN: "(" },
      input: "",
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/KB_WORKITEM_PATTERN/);
    expect(res.stdout).toBe("");
  });
});
