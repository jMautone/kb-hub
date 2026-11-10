import { Command } from "commander";
import { packageVersion } from "./core/package-info.js";
import { compileWorkItemPattern, ConfigError } from "./core/provenance.js";
import { initVault, resolveVaultPath, VaultError } from "./core/vault.js";
import { startServer } from "./mcp/server.js";

const program = new Command()
  .name("kb-hub")
  .description("A markdown knowledge vault for coding agents, served over MCP.")
  .version(packageVersion());

program
  .command("init")
  .description("Create a new vault in <dir>")
  .argument("<dir>", "folder for the vault (created if missing, must be empty)")
  .action(async (dir: string) => {
    const result = await initVault(dir);
    if (result.status === "exists") {
      console.log(`Vault already exists at ${result.path}. Nothing changed.`);
      return;
    }
    const isWindows = process.platform === "win32";
    const add = isWindows
      ? `claude mcp add kb --scope user -- cmd /c npx -y kb-hub mcp --vault "${result.path}"`
      : `claude mcp add kb --scope user -- npx -y kb-hub mcp --vault "${result.path}"`;
    console.log(`Created vault at ${result.path}\n\nNext, connect it to Claude Code:\n  ${add}`);
  });

program
  .command("mcp")
  .description("Start the MCP server over stdio")
  .option("--vault <dir>", "vault folder (defaults to the KB_VAULT environment variable)")
  .action(async (opts: { vault?: string }) => {
    const vault = resolveVaultPath(opts.vault, process.env.KB_VAULT);
    const workItemPattern = compileWorkItemPattern(process.env.KB_WORKITEM_PATTERN);
    await startServer(vault, { provenance: { workItemPattern } });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof VaultError || err instanceof ConfigError) {
    process.stderr.write(`kb-hub: ${err.message}\n`);
  } else {
    process.stderr.write(`kb-hub: unexpected error: ${err instanceof Error ? err.stack : String(err)}\n`);
  }
  process.exit(1);
});
