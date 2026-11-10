import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getProvenance, parseRemote, workItemFromBranch } from "../src/core/provenance.js";
import { makeGitRepo, tempDir } from "./helpers.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
async function tmp() {
  const t = await tempDir();
  cleanups.push(t.cleanup);
  return t.path;
}

describe("parseRemote", () => {
  it.each([
    ["https://github.com/mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["https://github.com/mate-and-co/storefront", "mate-and-co/storefront"],
    ["git@github.com:mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["ssh://git@gitlab.com/mate-and-co/storefront.git", "mate-and-co/storefront"],
    ["https://user@dev.azure.com/contoso/Shop/_git/storefront", "contoso/Shop/storefront"],
    ["https://dev.azure.com/contoso/My%20Shop/_git/storefront", "contoso/My Shop/storefront"],
    ["git@ssh.dev.azure.com:v3/contoso/Shop/storefront", "contoso/Shop/storefront"],
    ["contoso@vs-ssh.visualstudio.com:v3/contoso/Shop/storefront", "contoso/Shop/storefront"],
    ["https://contoso.visualstudio.com/DefaultCollection/Shop/_git/storefront", "contoso/Shop/storefront"],
  ])("%s → %s", (url, expected) => {
    expect(parseRemote(url)).toBe(expected);
  });

  it("never keeps credentials", () => {
    const parsed = parseRemote("https://ana:s3cret-token@github.com/mate-and-co/storefront.git");
    expect(parsed).toBe("mate-and-co/storefront");
    expect(parsed).not.toContain("s3cret");
    expect(parseRemote("https://user@dev.azure.com/contoso/Shop/_git/storefront")).not.toContain("user@");
  });
});

describe("workItemFromBranch", () => {
  it.each([
    ["feature/4821-checkout", "4821"],
    ["bugfix/77-null-cart", "77"],
    ["4821-quick-fix", "4821"],
    ["users/ana/4821_shipping", "4821"],
    ["main", null],
    ["feature/v2-checkout", null],
    ["release/2026", "2026"],
  ])("%s → %s", (branch, expected) => {
    expect(workItemFromBranch(branch, undefined)).toBe(expected);
  });

  it("uses a custom pattern's first group", () => {
    expect(workItemFromBranch("feature/AB#1234-x", "AB#(\\d+)")).toBe("1234");
    expect(workItemFromBranch("feature/PROJ-88-login", "(PROJ-\\d+)")).toBe("PROJ-88");
  });

  it("returns null without a branch", () => {
    expect(workItemFromBranch(null)).toBeNull();
  });
});

describe("getProvenance", () => {
  it("reads repo, branch, commit and work item", async () => {
    const dir = await tmp();
    const sha = makeGitRepo(dir, "feature/4821-checkout", "git@github.com:mate-and-co/storefront.git");
    expect(await getProvenance(dir)).toEqual({
      repo: "mate-and-co/storefront",
      branch: "feature/4821-checkout",
      commit: sha,
      work_item: "4821",
    });
  });

  it("works from a subfolder of the repo", async () => {
    const dir = await tmp();
    makeGitRepo(dir, "main", "https://github.com/mate-and-co/storefront.git");
    await mkdir(join(dir, "src", "cart"), { recursive: true });
    expect((await getProvenance(join(dir, "src", "cart"))).repo).toBe("mate-and-co/storefront");
  });

  it("falls back to the folder name without origin", async () => {
    const dir = await tmp();
    makeGitRepo(dir, "main");
    const p = await getProvenance(dir);
    expect(p.repo).toBe(basename(dir));
    expect(p.work_item).toBeNull();
  });

  it("returns a null branch in detached HEAD", async () => {
    const dir = await tmp();
    const sha = makeGitRepo(dir, "main");
    execFileSync("git", ["checkout", "-q", "--detach"], { cwd: dir });
    const p = await getProvenance(dir);
    expect(p.branch).toBeNull();
    expect(p.commit).toBe(sha);
  });

  it("returns all nulls outside a repo", async () => {
    const dir = await tmp();
    expect(await getProvenance(dir)).toEqual({ repo: null, branch: null, commit: null, work_item: null });
  });
});
