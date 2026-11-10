#!/usr/bin/env node
// Calls one kb-hub tool the way an agent would, and prints its text result.
// Usage: node demo/call.mjs <vault> <tool> [json-args]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const [vault, tool, json = "{}"] = process.argv.slice(2);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const client = new Client({ name: "kb-hub-demo", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp", "--vault", vault], stderr: "ignore" }));
const result = await client.callTool({ name: tool, arguments: JSON.parse(json) });
console.log(result.content.map((c) => c.text).join("\n"));
await client.close();
