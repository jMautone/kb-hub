import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Where a capture came from. Every field is `null` when it can't be known. */
export type Provenance = {
  repo: string | null;
  branch: string | null;
  commit: string | null;
  work_item: string | null;
};

export const EMPTY_PROVENANCE: Provenance = Object.freeze({ repo: null, branch: null, commit: null, work_item: null });

/** A configuration value the user set (for example an environment variable) is invalid. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** First run of two or more digits that starts the branch name or follows a `/`, and ends at `-`, `_`, `/` or the end. */
export const DEFAULT_WORK_ITEM_PATTERN = /(?:^|\/)(\d{2,})(?=[-_/]|$)/;

/** Builds the work item pattern from `KB_WORKITEM_PATTERN`, or returns the default when it is unset or blank. */
export function compileWorkItemPattern(source: string | undefined): RegExp {
  if (source === undefined || source.trim() === "") return DEFAULT_WORK_ITEM_PATTERN;
  try {
    return new RegExp(source);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`KB_WORKITEM_PATTERN is not a valid regular expression (${reason}).`);
  }
}

/** The work item ID in a branch name: the pattern's first capture group, or the whole match when it has none. */
export function extractWorkItem(branch: string, pattern: RegExp = DEFAULT_WORK_ITEM_PATTERN): string | null {
  const match = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).exec(branch);
  if (!match) return null;
  const id = match.length > 1 ? match[1] : match[0];
  return id ? id : null;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const AZURE_HOSTS = ["dev.azure.com", "ssh.dev.azure.com", "vs-ssh.visualstudio.com"];

function isAzureHost(host: string): boolean {
  return AZURE_HOSTS.includes(host) || host.endsWith(".visualstudio.com");
}

/** `org/project/repo` from the path of an Azure DevOps remote, or null when the path has another shape. */
function azureRepo(host: string, segments: string[]): string | null {
  // SSH: v3/<org>/<project>/<repo>
  if (segments[0] === "v3" && segments.length >= 4) return segments.slice(1, 4).join("/");
  const gitAt = segments.indexOf("_git");
  const repo = gitAt >= 0 ? segments[gitAt + 1] : undefined;
  if (!repo) return null;
  const before = segments.slice(0, gitAt).filter((s) => s.toLowerCase() !== "defaultcollection");
  // Old-style host: <org>.visualstudio.com/<project>/_git/<repo>
  const org = host.endsWith(".visualstudio.com") && host !== "vs-ssh.visualstudio.com" ? host.split(".")[0] : before.shift();
  // A repo named like its project can be addressed without the project: <org>/_git/<repo>.
  const project = before[0] ?? repo;
  return org ? [org, project, repo].join("/") : null;
}

/**
 * The repository name from a git remote URL: `owner/name` for GitHub-style hosts (the full path for nested
 * groups) and `org/project/repo` for Azure DevOps. Credentials are dropped. Local paths and `file://` URLs
 * give null, so the caller can fall back to the folder name.
 */
export function parseRemoteUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  let host: string;
  let path: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    if (parsed.protocol === "file:") return null;
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname;
  } else {
    // scp-like syntax: [user@]host:path. A single letter before the colon is a Windows drive, not a host.
    const scp = /^(?:[^@/\\]+@)?([^:/\\]+):(.+)$/.exec(raw);
    if (!scp || scp[1]!.length === 1) return null;
    host = scp[1]!.toLowerCase();
    path = scp[2]!;
  }

  const segments = path.split("/").filter(Boolean).map(decodeSegment);
  const last = segments.length - 1;
  if (last < 0) return null;
  segments[last] = segments[last]!.replace(/\.git$/i, "");
  if (!segments[last]) return null;

  if (isAzureHost(host)) return azureRepo(host, segments);
  return segments.join("/");
}

export type ProvenanceOptions = {
  /** Work item pattern; defaults to DEFAULT_WORK_ITEM_PATTERN. */
  workItemPattern?: RegExp;
  /** git executable; defaults to `git` on PATH. */
  gitBinary?: string;
  /** Timeout for each git call, in milliseconds. */
  timeoutMs?: number;
};

/** Environment for git calls: never prompt, never take locks, and ignore repo overrides so `cwd` decides. */
function gitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete env[key];
  return env;
}

async function runGit(args: string[], cwd: string, options: ProvenanceOptions): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(options.gitBinary ?? "git", args, {
      cwd,
      timeout: options.timeoutMs ?? 2000,
      windowsHide: true,
      encoding: "utf8",
      env: gitEnv(),
    });
    const out = stdout.trim();
    return out || null;
  } catch {
    // Not a repo, no commits yet, no origin, git missing or too slow: the field is unknown.
    return null;
  }
}

/**
 * Reads repo, branch, short commit and work item from the git repository that contains `cwd`.
 * Never throws: outside a repo, or without git, every field is null.
 */
export async function getProvenance(cwd: string, options: ProvenanceOptions = {}): Promise<Provenance> {
  const top = await runGit(["rev-parse", "--show-toplevel"], cwd, options);
  if (top === null) return { ...EMPTY_PROVENANCE };

  const [branch, commit, remote] = await Promise.all([
    // Fails in detached HEAD, which is what we want: there is no branch.
    runGit(["symbolic-ref", "--short", "-q", "HEAD"], cwd, options),
    runGit(["rev-parse", "--short", "HEAD"], cwd, options),
    runGit(["remote", "get-url", "origin"], cwd, options),
  ]);

  const repo = (remote && parseRemoteUrl(remote)) || basename(top) || null;
  const work_item = branch ? extractWorkItem(branch, options.workItemPattern) : null;
  return { repo, branch, commit, work_item };
}
