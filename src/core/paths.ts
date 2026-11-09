import { realpathSync } from "node:fs";
import { join, posix, relative, resolve, sep, win32 } from "node:path";

export type PathErrorCode = "absolute" | "outside" | "not-markdown" | "not-found";

export class PathError extends Error {
  constructor(
    readonly code: PathErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PathError";
  }
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !win32.isAbsolute(rel) && !posix.isAbsolute(rel));
}

/**
 * Resolves a vault-relative path (with `/` or `\` separators) to an absolute path inside the vault.
 * Rejects absolute paths, traversal outside the vault, and symlinks that point outside it.
 */
export function resolveInVault(vault: string, rel: string): string {
  if (posix.isAbsolute(rel) || win32.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw new PathError("absolute", `Only vault-relative paths are accepted, got "${rel}".`);
  }
  const root = resolve(vault);
  const target = resolve(root, join(...rel.split(/[\\/]+/).filter(Boolean)));
  if (!isInside(root, target)) {
    throw new PathError("outside", `"${rel}" is outside the vault.`);
  }
  // Follow symlinks when the target exists, and check again.
  let real: string | undefined;
  try {
    real = realpathSync(target);
  } catch {
    real = undefined;
  }
  if (real !== undefined && !isInside(realpathSync(root), real)) {
    throw new PathError("outside", `"${rel}" is outside the vault.`);
  }
  return target;
}

/** Path relative to the vault root with `/` separators, whatever the OS. */
export function toPosixRelative(vault: string, absolute: string): string {
  return relative(vault, absolute).split(sep).join("/");
}
