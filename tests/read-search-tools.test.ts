import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cliPath, demoVault } from "./helpers.js";

let client: Client;

beforeAll(async () => {
  client = new Client({ name: "kb-hub-test", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [cliPath, "mcp", "--vault", demoVault], stderr: "pipe" }),
  );
});
afterAll(async () => {
  await client.close();
});

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }>; structuredContent?: unknown };

function text(result: ToolResult): string {
  return result.content.map((c) => c.text).join("\n");
}

async function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    return (await client.callTool({ name, arguments: args })) as ToolResult;
  } catch (err) {
    // Some SDK versions reject invalid input with a protocol error instead of an error result.
    return { isError: true, content: [{ type: "text", text: String(err) }] };
  }
}

describe("read tool", () => {
  it("returns frontmatter and body", async () => {
    const result = await call("read", { path: "wiki/checkout-flow.md" });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { path: string; frontmatter: Record<string, unknown>; body: string };
    expect(data.path).toBe("wiki/checkout-flow.md");
    expect(data.frontmatter.title).toBe("Checkout flow");
    expect(data.body).toContain("## How a payment goes through");
  });

  it("refuses paths outside the vault", async () => {
    const result = await call("read", { path: "../secrets.md" });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/outside the vault/);
  });

  it("refuses absolute paths", async () => {
    for (const path of ["/etc/passwd", "C:\\Windows\\win.ini"]) {
      const result = await call("read", { path });
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/vault-relative/);
    }
  });

  it("suggests the closest page on a typo", async () => {
    const result = await call("read", { path: "wiki/chekout-flow.md" });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("wiki/checkout-flow.md");
  });

  it("only reads markdown", async () => {
    const result = await call("read", { path: "outputs/diagram.png" });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/markdown/);
  });
});

describe("search tool", () => {
  it("returns ranked results", async () => {
    const result = await call("search", { query: "checkout" });
    const { results } = result.structuredContent as { results: Array<{ path: string; kind: string }> };
    expect(results[0]?.path).toBe("wiki/checkout-flow.md");
    expect(text(result)).toContain("Checkout flow");
  });

  it("applies the limit", async () => {
    const result = await call("search", { query: "checkout", limit: 2 });
    expect((result.structuredContent as { results: unknown[] }).results).toHaveLength(2);
  });

  it("rejects an empty query, naming the field", async () => {
    const result = await call("search", { query: "  " });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/query/);
  });

  it("rejects a limit above 50, naming the field", async () => {
    const result = await call("search", { query: "checkout", limit: 51 });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/limit/);
  });

  it("hints when nothing matches", async () => {
    const result = await call("search", { query: "zanzibarite" });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { results: unknown[] }).results).toEqual([]);
    expect(text(result)).toMatch(/fewer or different words/);
  });
});
