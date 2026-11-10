import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatStatus, vaultStatus } from "../../core/status.js";

export function registerStatus(server: McpServer, vault: string): void {
  server.registerTool(
    "status",
    {
      title: "Vault status",
      description:
        "Bookkeeping of the vault: captures in raw/inbox/ that no wiki or project page cites in its `sources` yet, broken [[wikilinks]], the latest log entries and page counts. Use it before compiling captures into wiki pages.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const status = await vaultStatus(vault);
      return { content: [{ type: "text", text: formatStatus(status) }], structuredContent: status };
    },
  );
}
