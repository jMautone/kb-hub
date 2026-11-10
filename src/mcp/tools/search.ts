import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchIndex } from "../../core/search.js";

export function registerSearch(server: McpServer, index: SearchIndex): void {
  server.registerTool(
    "search",
    {
      title: "Search the vault",
      description:
        "Full-text search over the knowledge vault (wiki pages, project notes and raw captures). Use two or three distinctive words. Compiled wiki pages rank above raw captures.",
      inputSchema: {
        query: z.string().trim().min(1).describe("Words to search for"),
        limit: z.number().int().min(1).max(50).default(10).describe("Maximum results, 1 to 50 (default 10)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      const results = await index.search(query, limit);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No pages match "${query}". Try fewer or different words.` }],
          structuredContent: { results: [] },
        };
      }
      const text = results.map((r, i) => `${i + 1}. ${r.title} (${r.path}, ${r.kind})\n   ${r.snippet}`).join("\n");
      return { content: [{ type: "text", text }], structuredContent: { results } };
    },
  );
}
