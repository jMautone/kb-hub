import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileWorkItemPattern,
  ConfigError,
  DEFAULT_WORK_ITEM_PATTERN,
  extractWorkItem,
  getProvenance,
  parseRemoteUrl,
} from "../src/core/provenance.js";
import { git, makeRepo, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function tmp() {
  const t = await tempDir("kb-hub-repo-");
  cleanups.push(t.cleanup);
  return t.path;
}

describe("parseRemoteUrl", () => {
  it.each([
    ["https://github.com/mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["https://github.com/mate-and-co/storefront", "mate-and-co/storefront"],
    ["https://github.com/mate-and-co/storefront/", "mate-and-co/storefront"],
    ["git@github.com:mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["ssh://git@github.com:22/mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["https://gitlab.com/mate-and-co/web/storefront.git", "mate-and-co/web/storefront"],
  ])("GitHub-style %s", (url, repo) => {
    expect(parseRemoteUrl(url)).toBe(repo);
  });

  it.each([
    ["https://dev.azure.com/contoso/Shop/_git/storefront", "contoso/Shop/storefront"],
    ["https://contoso@dev.azure.com/contoso/Shop/_git/storefront", "contoso/Shop/storefront"],
    ["https://dev.azure.com/contoso/Mate%20Shop/_git/storefront", "contoso/Mate Shop/storefront"],
    ["https://dev.azure.com/contoso/_git/storefront", "contoso/storefront/storefront"],
    ["https://contoso.visualstudio.com/Shop/_git/storefront", "contoso/Shop/storefront"],
    ["https://contoso.visualstudio.com/DefaultCollection/Shop/_git/storefront", "contoso/Shop/storefront"],
    ["git@ssh.dev.azure.com:v3/contoso/Shop/storefront", "contoso/Shop/storefront"],
    ["contoso@vs-ssh.visualstudio.com:v3/contoso/Shop/storefront", "contoso/Shop/storefront"],
  ])("Azure DevOps %s", (url, repo) => {
    expect(parseRemoteUrl(url)).toBe(repo);
  });

  it("drops credentials", () => {
    for (const url of [
      "https://user@dev.azure.com/contoso/Shop/_git/storefront",
      "https://user:s3cret@github.com/mate-and-co/storefront.git",
      "https://x-access-token:ghp_abc123@github.com/mate-and-co/storefront.git",
    ]) {
      const repo = parseRemoteUrl(url)!;
      expect(repo).not.toMatch(/user|s3cret|ghp_|@/);
    }
  });

  it("gives null for local paths, so the folder name is used", () => {
    for (const url of ["/srv/git/storefront.git", "../storefront", "C:\\repos\\storefront", "C:/repos/storefront", "file:///srv/git/storefront.git", ""]) {
      expect(parseRemoteUrl(url), url).toBeNull();
    }
  });
});

describe("work item", () => {
  it.each([
    ["feature/4821-checkout", "4821"],
    ["bugfix/77-null-cart", "77"],
    ["4821-checkout", "4821"],
    ["users/ana/4821_checkout", "4821"],
    ["feature/4821", "4821"],
    ["main", null],
    ["release/2.3", null],
    ["feature/7-one-digit", null],
    ["feature/checkout-4821", null],
  ])("default pattern on %s", (branch, id) => {
    expect(extractWorkItem(branch)).toBe(id);
  });

  it("uses the first capture group of KB_WORKITEM_PATTERN", () => {
    expect(extractWorkItem("feature/AB#1234-checkout", compileWorkItemPattern("AB#(\\d+)"))).toBe("1234");
    expect(extractWorkItem("PROJ-123-checkout", compileWorkItemPattern("([A-Z]+-\\d+)"))).toBe("PROJ-123");
  });

  it("uses the whole match when the pattern has no group", () => {
    expect(extractWorkItem("feature/PROJ-9-x", compileWorkItemPattern("[A-Z]+-\\d+"))).toBe("PROJ-9");
  });

  it("falls back to the default when the variable is unset or blank", () => {
    expect(compileWorkItemPattern(undefined)).toBe(DEFAULT_WORK_ITEM_PATTERN);
    expect(compileWorkItemPattern("  ")).toBe(DEFAULT_WORK_ITEM_PATTERN);
  });

  it("rejects an invalid pattern with a clear error", () => {
    expect(() => compileWorkItemPattern("(")).toThrow(ConfigError);
    expect(() => compileWorkItemPattern("(")).toThrow(/KB_WORKITEM_PATTERN/);
  });
});

describe("getProvenance", () => {
  it("reads repo, branch, commit and work item", async () => {
    const dir = await makeRepo(await tmp(), {
      branch: "feature/4821-checkout",
      origin: "https://user@dev.azure.com/contoso/Shop/_git/storefront",
    });
    const commit = await git(dir, ["rev-parse", "--short", "HEAD"]);
    expect(await getProvenance(dir)).toEqual({
      repo: "contoso/Shop/storefront",
      branch: "feature/4821-checkout",
      commit,
      work_item: "4821",
    });
  });

  it("works from a subfolder of the repo", async () => {
    const dir = await makeRepo(await tmp(), { branch: "bugfix/77-null-cart", origin: "git@github.com:mate-and-co/storefront.git" });
    const sub = join(dir, "src", "cart");
    await mkdir(sub, { recursive: true });
    expect(await getProvenance(sub)).toMatchObject({ repo: "mate-and-co/storefront", work_item: "77" });
  });

  it("has no branch in detached HEAD, but keeps the commit", async () => {
    const dir = await makeRepo(await tmp(), { branch: "main" });
    const commit = await git(dir, ["rev-parse", "--short", "HEAD"]);
    await git(dir, ["checkout", "-q", "--detach"]);
    expect(await getProvenance(dir)).toMatchObject({ branch: null, commit, work_item: null });
  });

  it("uses the folder name when there is no origin", async () => {
    const parent = await tmp();
    const dir = await makeRepo(join(parent, "my storefront"), { branch: "main" });
    expect((await getProvenance(dir)).repo).toBe("my storefront");
  });

  it("handles a repo with no commits yet", async () => {
    const dir = await makeRepo(await tmp(), { branch: "feature/12-first", commit: false });
    expect(await getProvenance(dir)).toMatchObject({ branch: "feature/12-first", commit: null, work_item: "12" });
  });

  it("applies a custom work item pattern", async () => {
    const dir = await makeRepo(await tmp(), { branch: "PROJ-123-checkout" });
    const prov = await getProvenance(dir, { workItemPattern: compileWorkItemPattern("([A-Z]+-\\d+)") });
    expect(prov.work_item).toBe("PROJ-123");
  });

  it("returns all nulls outside a git repo", async () => {
    expect(await getProvenance(await tmp())).toEqual({ repo: null, branch: null, commit: null, work_item: null });
  });

  it("returns all nulls when git is not installed", async () => {
    const dir = await makeRepo(await tmp(), { branch: "main" });
    const prov = await getProvenance(dir, { gitBinary: join(dir, "no-such-git") });
    expect(prov).toEqual({ repo: null, branch: null, commit: null, work_item: null });
  });
});
