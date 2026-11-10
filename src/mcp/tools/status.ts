import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchIndex } from "../../core/search.js";
import { formatStatus, vaultStatus } from "../../core/status.js";

export function registerStatus(server: McpServer, vault: string, index: SearchIndex): void {
  server.registerTool(
    "status",
    {
      title: "Vault status",
      description:
        "The vault's bookkeeping, computed without a model: captures not yet compiled into a wiki or project page, broken [[wikilinks]], the latest log entries and page counts. Show the summary to the user as is.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const status = await vaultStatus(vault, index);
      const summary = formatStatus(status);
      // Some clients (Claude Code among them) give the model only structuredContent, so the summary goes in both.
      return { content: [{ type: "text", text: summary }], structuredContent: { ...status, summary } };
    },
  );
}
