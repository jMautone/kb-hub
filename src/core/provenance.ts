import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type Provenance = {
  repo: string | null;
  branch: string | null;
  commit: string | null;
  work_item: string | null;
};

export const EMPTY_PROVENANCE: Provenance = { repo: null, branch: null, commit: null, work_item: null };

/** Default: the first run of 2+ digits that starts the branch name or follows a `/`. */
export const DEFAULT_WORKITEM_PATTERN = /(?:^|\/)(\d{2,})(?=[-_/]|$)/;

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", args, { cwd, timeout: 2000, windowsHide: true });
    const out = stdout.trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

/**
 * Turns a git remote URL into a portable repo name, dropping any credentials.
 * GitHub-style hosts give `owner/name`; Azure DevOps gives `org/project/name`.
 */
export function parseRemote(url: string): string | null {
  let rest = url.trim();
  if (!rest) return null;

  // Azure DevOps SSH: git@ssh.dev.azure.com:v3/org/project/repo or org@vs-ssh.visualstudio.com:v3/org/project/repo
  const adoSsh = /:v3\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(rest);
  if (adoSsh) return `${adoSsh[1]}/${decodeURIComponent(adoSsh[2]!)}/${adoSsh[3]}`;

  // URL forms: drop scheme and userinfo.
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(rest);
  let path: string;
  if (scheme) {
    rest = rest.slice(scheme[0].length);
    rest = rest.replace(/^[^@/]*@/, "");
    path = rest.slice(rest.indexOf("/") + 1);
  } else {
    // scp-like: user@host:owner/name.git
    const scp = /^(?:[^@]+@)?[^:]+:(.+)$/.exec(rest);
    if (!scp) return null;
    path = scp[1]!;
  }
  path = path.replace(/\.git\/?$/, "").replace(/\/+$/, "");

  // Azure DevOps HTTPS: org/project/_git/repo (dev.azure.com) or project/_git/repo (org.visualstudio.com)
  const parts = path.split("/").map((p) => decodeURIComponent(p));
  const gitIdx = parts.indexOf("_git");
  if (gitIdx !== -1) {
    const before = parts.slice(0, gitIdx).filter((p) => p !== "DefaultCollection");
    const host = scheme ? rest.split("/")[0]! : "";
    const vsOrg = /^([^.]+)\.visualstudio\.com$/.exec(host)?.[1];
    const org = vsOrg ? [vsOrg] : [];
    return [...org, ...before, parts[gitIdx + 1]].filter(Boolean).join("/");
  }
  return parts.slice(-2).join("/") || null;
}

/** Extracts a work item ID from a branch name, using KB_WORKITEM_PATTERN when given. */
export function workItemFromBranch(branch: string | null, pattern = process.env.KB_WORKITEM_PATTERN): string | null {
  if (!branch) return null;
  let regex = DEFAULT_WORKITEM_PATTERN;
  if (pattern) {
    try {
      regex = new RegExp(pattern);
    } catch {
      regex = DEFAULT_WORKITEM_PATTERN;
    }
  }
  const match = regex.exec(branch);
  return match?.[1] ?? null;
}

/** Reads repo, branch, commit and work item from the git repository at `cwd`. All null outside a repo. */
export async function getProvenance(cwd: string, workItemPattern?: string): Promise<Provenance> {
  const top = await git(cwd, ["rev-parse", "--show-toplevel"]);
  if (!top) return { ...EMPTY_PROVENANCE };
  const [branchRaw, commit, remote] = await Promise.all([
    git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(cwd, ["rev-parse", "--short", "HEAD"]),
    git(cwd, ["remote", "get-url", "origin"]),
  ]);
  const branch = branchRaw === "HEAD" ? null : branchRaw;
  const repo = (remote && parseRemote(remote)) || basename(top);
  return { repo, branch, commit, work_item: workItemFromBranch(branch, workItemPattern) };
}
