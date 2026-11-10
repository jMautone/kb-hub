import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { capture, CaptureError } from "../../core/capture.js";
import { errorResult } from "./results.js";

export function registerCapture(server: McpServer, vault: string): void {
  server.registerTool(
    "capture",
    {
      title: "Capture a note",
      description:
        "Save something worth remembering beyond this session (a root cause, a decision, a command that worked, context the user explained) to the vault inbox. The note is stamped with the current repo, branch, commit and work item. One topic per capture; write it so it makes sense to someone who did not see the session. Never capture secrets.",
      inputSchema: {
        text: z.string().trim().min(1).describe("The note, in markdown"),
        title: z.string().trim().min(1).max(120).optional().describe("Short, specific title"),
        tags: z.array(z.string().trim().min(1)).max(10).optional().describe("A few lowercase tags"),
        cwd: z
          .string()
          .min(1)
          .optional()
          .describe("Absolute path of the repo the note is about, if the server does not run inside it"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      try {
        const result = await capture(vault, input);
        const p = result.provenance;
        const where = p.repo
          ? ` from ${p.repo}${p.branch ? ` on ${p.branch}` : ""}${p.commit ? ` at ${p.commit}` : ""}${p.work_item ? ` (work item ${p.work_item})` : ""}`
          : " (no git repository found, provenance left empty)";
        return {
          content: [{ type: "text", text: `Captured "${result.title}" to ${result.path}${where}.` }],
          structuredContent: result,
        };
      } catch (err) {
        if (err instanceof CaptureError) return errorResult(err.message);
        throw err;
      }
    },
  );
}
