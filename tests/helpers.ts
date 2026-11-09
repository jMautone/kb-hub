import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "..");
export const cliPath = join(repoRoot, "dist", "cli.js");
export const demoVault = join(repoRoot, "examples", "demo-vault");

export async function tempDir(prefix = "kb-hub-"): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}

/** Copies the example vault into a temp folder so tests never write to the original. */
export async function copyDemoVault(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await tempDir("kb-hub-vault-");
  const path = join(dir.path, "vault");
  await cp(demoVault, path, { recursive: true });
  return { path, cleanup: dir.cleanup };
}
