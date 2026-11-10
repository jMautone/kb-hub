import { existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { appendLog } from "./log.js";
import { packageRoot } from "./package-info.js";

/** Files and folders that make a folder a vault. */
const REQUIRED_FILES = ["AGENTS.md", "log.md"];
const REQUIRED_DIRS = [join("raw", "inbox")];

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

export type InitResult = { status: "created" | "exists"; path: string };

/** Expands a leading `~` and resolves to an absolute path. */
export function expandPath(input: string, home = homedir()): string {
  if (input === "~") return home;
  if (input.startsWith("~/") || input.startsWith("~\\")) return resolve(home, input.slice(2));
  return resolve(input);
}

/** True when `dir` exists and has AGENTS.md, log.md and raw/inbox/. */
export function isVault(dir: string): boolean {
  try {
    if (!statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return (
    REQUIRED_FILES.every((f) => existsSync(join(dir, f))) &&
    REQUIRED_DIRS.every((d) => {
      try {
        return statSync(join(dir, d)).isDirectory();
      } catch {
        return false;
      }
    })
  );
}

/**
 * Picks the vault path: the flag wins over the environment variable.
 * Throws a VaultError with a user-facing message when none is set or the folder is not a vault.
 */
export function resolveVaultPath(flag: string | undefined, env: string | undefined, home = homedir()): string {
  const raw = flag?.trim() || env?.trim();
  if (!raw) {
    throw new VaultError("No vault configured. Pass --vault <dir> or set the KB_VAULT environment variable.");
  }
  const path = expandPath(raw, home);
  if (!isVault(path)) {
    throw new VaultError(`${path} is not a kb-hub vault. Create one with: kb-hub init "${raw}"`);
  }
  return path;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

/** Formats a date as YYYY-MM-DD in local time. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Creates a vault from the bundled template. Never overwrites existing content. */
export async function initVault(dirInput: string, now = new Date()): Promise<InitResult> {
  const dir = expandPath(dirInput);

  if (existsSync(dir)) {
    if (!statSync(dir).isDirectory()) throw new VaultError(`${dir} exists and is not a folder.`);
    if (isVault(dir)) return { status: "exists", path: dir };
    const existing = await readdir(dir);
    if (existing.length > 0) {
      throw new VaultError(`${dir} is not empty. Choose an empty or new folder for the vault.`);
    }
  }

  const templateDir = join(packageRoot(), "templates", "vault");
  for (const src of await listFiles(templateDir)) {
    const rel = relative(templateDir, src);
    const dest = join(dir, rel);
    await mkdir(dirname(dest), { recursive: true });
    // Normalize to LF so vaults are byte-identical on every OS.
    const content = (await readFile(src, "utf8")).replace(/\r\n/g, "\n");
    await writeFile(dest, content, { encoding: "utf8", flag: "wx" });
  }

  await appendLog(dir, `## [${isoDate(now)}] init\n`);
  return { status: "created", path: dir };
}

/** Path relative to the vault, always with `/` separators. */
export function toVaultRelative(vault: string, absolute: string): string {
  return relative(vault, absolute).split(sep).join("/");
}
