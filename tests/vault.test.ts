import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expandPath, initVault, isVault, resolveVaultPath, VaultError } from "../src/core/vault.js";
import { demoVault, repoRoot, tempDir } from "./helpers.js";

const LAYOUT = ["AGENTS.md", "CLAUDE.md", "index.md", "log.md", "raw/inbox", "wiki", "projects", "outputs"];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function tmp() {
  const t = await tempDir();
  cleanups.push(t.cleanup);
  return t.path;
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const e of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (e.isFile()) out[join(e.parentPath, e.name).slice(dir.length)] = await readFile(join(e.parentPath, e.name), "utf8");
  }
  return out;
}

describe("vault-init", () => {
  it("creates the full layout in a new folder", async () => {
    const dir = join(await tmp(), "my-vault");
    const result = await initVault(dir, new Date(2026, 10, 9));
    expect(result).toEqual({ status: "created", path: dir });
    for (const item of LAYOUT) expect(existsSync(join(dir, item)), item).toBe(true);
    expect(isVault(dir)).toBe(true);
  });

  it("creates the layout inside an empty existing folder", async () => {
    const dir = await tmp();
    expect((await initVault(dir)).status).toBe("created");
    expect(isVault(dir)).toBe(true);
  });

  it("refuses a non-empty folder and changes nothing", async () => {
    const dir = await tmp();
    await writeFile(join(dir, "todo.md"), "buy yerba\n");
    await expect(initVault(dir)).rejects.toThrow(VaultError);
    await expect(initVault(dir)).rejects.toThrow(/not empty/);
    expect(await readdir(dir)).toEqual(["todo.md"]);
  });

  it("reports an existing vault and changes nothing", async () => {
    const dir = await tmp();
    await initVault(dir);
    const before = await snapshot(dir);
    expect((await initVault(dir)).status).toBe("exists");
    expect(await snapshot(dir)).toEqual(before);
  });

  it("writes agent instructions and a CLAUDE.md that only imports them", async () => {
    const dir = await tmp();
    await initVault(dir);
    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
    for (const section of ["## Folders", "## Searching", "## Capturing", "## Compiling"]) {
      expect(agents).toContain(section);
    }
    expect(agents).toContain("sources");
    expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
  });

  it("writes the first log entry with the date", async () => {
    const dir = await tmp();
    await initVault(dir, new Date(2026, 10, 9));
    const logText = await readFile(join(dir, "log.md"), "utf8");
    const entries = logText.split("\n").filter((l) => l.startsWith("## ["));
    expect(entries).toEqual(["## [2026-11-09] init"]);
  });

  it("works with paths that contain spaces", async () => {
    const dir = join(await tmp(), "Ana Perez", "my vault");
    expect((await initVault(dir)).status).toBe("created");
    expect(isVault(dir)).toBe(true);
  });

  it("writes template files with LF line endings, identical to the templates", async () => {
    const dir = await tmp();
    await initVault(dir);
    for (const file of ["AGENTS.md", "CLAUDE.md", "index.md"]) {
      const written = await readFile(join(dir, file), "utf8");
      const template = (await readFile(join(repoRoot, "templates", "vault", file), "utf8")).replace(/\r\n/g, "\n");
      expect(written).not.toContain("\r");
      expect(written).toBe(template);
    }
  });
});

describe("vault path resolution", () => {
  it("prefers the flag over the environment variable", async () => {
    const home = await tmp();
    await initVault(join(home, "my-vault"));
    expect(resolveVaultPath("~/my-vault", "/tmp/other", home)).toBe(join(home, "my-vault"));
  });

  it("falls back to KB_VAULT", () => {
    expect(resolveVaultPath(undefined, demoVault)).toBe(demoVault);
  });

  it("explains how to configure a vault when none is given", () => {
    expect(() => resolveVaultPath(undefined, undefined)).toThrow(/--vault.*KB_VAULT/);
  });

  it("suggests init when the folder is not a vault", async () => {
    const dir = await tmp();
    await mkdir(join(dir, "notes"));
    expect(() => resolveVaultPath(join(dir, "notes"), undefined)).toThrow(/kb-hub init/);
  });

  it("expands ~ with both separators", () => {
    expect(expandPath("~", "/home/ana")).toBe(expandPath("/home/ana"));
    expect(expandPath("~/kb", "/home/ana")).toBe(join(expandPath("/home/ana"), "kb"));
    expect(expandPath("~\\kb", "/home/ana")).toBe(join(expandPath("/home/ana"), "kb"));
  });

  it("accepts the example vault", () => {
    expect(isVault(demoVault)).toBe(true);
  });
});
