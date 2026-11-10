import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadPage } from "../../core/pages.js";
import { PathError } from "../../core/paths.js";
import { errorResult } from "./results.js";

export function registerRead(server: McpServer, vault: string): void {
  server.registerTool(
    "read",
    {
      title: "Read a vault page",
      description:
        "Read one markdown page of the knowledge vault by its vault-relative path (for example wiki/checkout-flow.md). Returns its frontmatter and body.",
      inputSchema: { path: z.string().min(1).describe("Vault-relative path to a .md page, with / separators") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => {
      try {
        const page = await loadPage(vault, path);
        const result = { path: page.path, title: page.title, frontmatter: page.frontmatter, body: page.body };
        return { content: [{ type: "text", text: page.body }], structuredContent: result };
      } catch (err) {
        if (err instanceof PathError) return errorResult(err.message);
        throw err;
      }
    },
  );
}
