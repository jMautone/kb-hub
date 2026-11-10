import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";
import { cliPath, copyDemoVault, makeGitRepo, tempDir } from "./helpers.js";

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }>; structuredContent?: unknown };
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function start(vault: string, cwd?: string) {
  const client = new Client({ name: "kb-hub-test", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [cliPath, "mcp", "--vault", vault], cwd, stderr: "pipe" }),
  );
  cleanups.push(() => client.close());
  return async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> => {
    try {
      return (await client.callTool({ name, arguments: args })) as ToolResult;
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: String(err) }] };
    }
  };
}

async function fixtures() {
  const vault = await copyDemoVault();
  cleanups.push(vault.cleanup);
  const repo = await tempDir("kb-hub-repo-");
  cleanups.push(repo.cleanup);
  const sha = makeGitRepo(repo.path, "bugfix/4821-shipping-rounding", "https://dev.azure.com/contoso/Shop/_git/storefront");
  return { vault: vault.path, repo: repo.path, sha };
}

describe("capture tool", () => {
  it("takes provenance from the server's working directory", async () => {
    const { vault, repo, sha } = await fixtures();
    const call = await start(vault, repo);
    const result = await call("capture", { text: "Finance expects half-even rounding.", title: "Shipping rounding answer" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { path: string; provenance: Record<string, unknown> };
    expect(data.provenance).toEqual({ repo: "contoso/Shop/storefront", branch: "bugfix/4821-shipping-rounding", commit: sha, work_item: "4821" });
    expect(result.content[0]!.text).toContain("work item 4821");
    expect(await readFile(join(vault, data.path), "utf8")).toContain("Finance expects half-even rounding.");
  });

  it("uses the cwd input when given", async () => {
    const { vault, repo } = await fixtures();
    const call = await start(vault);
    const result = await call("capture", { text: "note", cwd: repo });
    expect((result.structuredContent as { provenance: { repo: string } }).provenance.repo).toBe("contoso/Shop/storefront");
  });

  it("rejects empty text, naming the field", async () => {
    const { vault } = await fixtures();
    const call = await start(vault);
    const result = await call("capture", { text: "  " });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/text/);
  });
});

describe("status tool", () => {
  it("shows the new capture as pending", async () => {
    const { vault, repo } = await fixtures();
    const call = await start(vault, repo);
    await call("capture", { text: "note", title: "Brand new note" });
    const result = await call("status");
    const data = result.structuredContent as { pending: Array<{ title: string }>; broken_links: unknown[] };
    expect(data.pending.map((p) => p.title)).toContain("Brand new note");
    expect(data.broken_links).toHaveLength(1);
    expect(result.content[0]!.text).toContain("Pending captures (2)");
  });
});
