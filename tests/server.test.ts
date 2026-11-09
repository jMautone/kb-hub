import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";
import { cliPath, demoVault, tempDir } from "./helpers.js";

const clients: Client[] = [];
afterEach(async () => {
  while (clients.length) await clients.pop()!.close();
});

async function connect(args: string[], env: Record<string, string> = {}): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, ...args],
    env: { ...(process.env as Record<string, string>), ...env },
    stderr: "pipe",
  });
  const client = new Client({ name: "kb-hub-test", version: "0.0.0" });
  await client.connect(transport);
  clients.push(client);
  return client;
}

function runCli(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("mcp-server", () => {
  it("identifies itself and lists its tools", async () => {
    const client = await connect(["mcp", "--vault", demoVault]);
    expect(client.getServerVersion()?.name).toBe("kb-hub");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("ping");
  });

  it("answers ping with the vault path and version", async () => {
    const client = await connect(["mcp", "--vault", demoVault]);
    const result = await client.callTool({ name: "ping", arguments: {} });
    expect(result.structuredContent).toMatchObject({ vault: demoVault });
    expect(typeof (result.structuredContent as { version: string }).version).toBe("string");
  });

  it("takes the vault from KB_VAULT", async () => {
    const client = await connect(["mcp"], { KB_VAULT: demoVault });
    const result = await client.callTool({ name: "ping", arguments: {} });
    expect(result.structuredContent).toMatchObject({ vault: demoVault });
  });

  it("exits with an error on stderr when no vault is configured", () => {
    const res = runCli(["mcp"], { KB_VAULT: undefined });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/--vault/);
    expect(res.stderr).toMatch(/KB_VAULT/);
    expect(res.stdout).toBe("");
  });

  it("suggests init when the folder is not a vault", async () => {
    const t = await tempDir();
    try {
      const notes = join(t.path, "notes");
      await mkdir(notes);
      const res = runCli(["mcp", "--vault", notes]);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toMatch(/kb-hub init/);
      expect(res.stdout).toBe("");
    } finally {
      await t.cleanup();
    }
  });
});

describe("cli init", () => {
  it("creates a vault and prints the next step", async () => {
    const t = await tempDir();
    try {
      const dir = join(t.path, "my vault");
      const res = runCli(["init", dir]);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(dir);
      expect(res.stdout).toContain("claude mcp add kb");
    } finally {
      await t.cleanup();
    }
  });

  it("fails on a non-empty folder", () => {
    const res = runCli(["init", join(cliPath, "..")]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/not empty/);
  });
});
