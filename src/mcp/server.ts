import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { packageVersion } from "../core/package-info.js";
import type { ProvenanceOptions } from "../core/provenance.js";
import { SearchIndex } from "../core/search.js";
import { log } from "./logger.js";
import { registerCapture } from "./tools/capture.js";
import { registerRead } from "./tools/read.js";
import { registerSearch } from "./tools/search.js";
import { registerStatus } from "./tools/status.js";

export type ServerOptions = {
  /** How capture reads provenance, for example the work item pattern from KB_WORKITEM_PATTERN. */
  provenance?: ProvenanceOptions;
};

/** Builds the MCP server for one vault. Tools are thin adapters over src/core. */
export function createServer(vault: string, options: ServerOptions = {}): McpServer {
  const version = packageVersion();
  const server = new McpServer({ name: "kb-hub", version });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Check that kb-hub is connected. Returns the absolute vault path and the kb-hub version.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const result = { vault, version };
      return {
        content: [{ type: "text", text: `kb-hub ${version} serving ${vault}` }],
        structuredContent: result,
      };
    },
  );

  // One index for search and status, so each only re-reads files that changed.
  const index = new SearchIndex(vault);
  registerRead(server, vault);
  registerSearch(server, index);
  registerCapture(server, vault, options.provenance);
  registerStatus(server, vault, index);

  return server;
}

export async function startServer(vault: string, options: ServerOptions = {}): Promise<void> {
  const server = createServer(vault, options);
  await server.connect(new StdioServerTransport());
  log.info(`serving ${vault}`);
}
