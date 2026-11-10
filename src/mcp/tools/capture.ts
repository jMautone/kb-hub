import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { capture, CaptureError, type CaptureResult } from "../../core/capture.js";
import { PathError } from "../../core/paths.js";
import type { ProvenanceOptions } from "../../core/provenance.js";
import { errorResult } from "./results.js";

function describeProvenance(result: CaptureResult): string {
  const p = result.provenance;
  if (p.repo === null) {
    return "No git repository was found in the working directory, so provenance is empty. If you are in a repo, pass its path as `cwd`.";
  }
  const parts = [`repo ${p.repo}`, p.branch ? `branch ${p.branch}` : "detached HEAD", p.commit ? `commit ${p.commit}` : "no commits yet"];
  if (p.work_item) parts.push(`work item ${p.work_item}`);
  return `Provenance: ${parts.join(", ")}.`;
}

export function registerCapture(server: McpServer, vault: string, provenance: ProvenanceOptions = {}): void {
  server.registerTool(
    "capture",
    {
      title: "Capture a note",
      description:
        "Save something worth remembering beyond this session (a root cause, a decision, a command that worked, context the user explained) as a new note in the vault inbox. The note is stamped with the current repo, branch, commit and work item. One topic per capture; write it so it makes sense without this conversation. Never capture secrets or personal data.",
      inputSchema: {
        text: z
          .string()
          .refine((s) => s.trim().length > 0, { message: "text must not be empty" })
          .describe("The note, in markdown: what, where, why, and what is still open"),
        title: z.string().max(200).optional().describe("Short, specific title. Defaults to the first words of the text"),
        tags: z.array(z.string().max(50)).max(20).optional().describe("Topic tags, for example [\"checkout\", \"bug\"]"),
        cwd: z
          .string()
          .min(1)
          .optional()
          .describe("Absolute path of the repository the note comes from. Only needed when the provenance comes out wrong"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      try {
        const result = await capture(vault, input, { provenance });
        const message = `Captured ${result.path} ("${result.title}"). ${describeProvenance(result)}`;
        // Some clients (Claude Code among them) give the model only structuredContent, so the message goes in both.
        return { content: [{ type: "text", text: message }], structuredContent: { ...result, message } };
      } catch (err) {
        if (err instanceof CaptureError || err instanceof PathError) return errorResult(err.message);
        throw err;
      }
    },
  );
}
