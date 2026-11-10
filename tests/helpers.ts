import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

export const repoRoot = resolve(import.meta.dirname, "..");
export const cliPath = join(repoRoot, "dist", "cli.js");
export const demoVault = join(repoRoot, "examples", "demo-vault");

export async function tempDir(prefix = "kb-hub-"): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return { path, cleanup: () => rm(path, { recursive: true, force: true, maxRetries: 3 }) };
}

/** Copies the example vault into a temp folder so tests never write to the original. */
export async function copyDemoVault(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await tempDir("kb-hub-vault-");
  const path = join(dir.path, "vault");
  await cp(demoVault, path, { recursive: true });
  return { path, cleanup: dir.cleanup };
}

const execFileAsync = promisify(execFile);

/** Runs git in `cwd` with a fixed identity and no signing, so tests don't depend on the machine's config. */
export async function git(cwd: string, args: string[]): Promise<string> {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "user.name=Ana Test", "-c", "user.email=ana@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, env, windowsHide: true },
  );
  return stdout.trim();
}

/** Creates a git repo in `dir` on `branch`, with one commit and an optional origin. */
export async function makeRepo(
  dir: string,
  options: { branch: string; origin?: string; commit?: boolean },
): Promise<string> {
  await mkdir(dir, { recursive: true });
  await git(dir, ["init", "-q"]);
  await git(dir, ["symbolic-ref", "HEAD", `refs/heads/${options.branch}`]);
  if (options.origin) await git(dir, ["remote", "add", "origin", options.origin]);
  if (options.commit !== false) {
    await writeFile(join(dir, "README.md"), "# Storefront\n");
    await git(dir, ["add", "README.md"]);
    await git(dir, ["commit", "-q", "-m", "first commit"]);
  }
  return dir;
}
