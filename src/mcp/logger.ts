/** Logs to stderr only: stdout is reserved for MCP protocol messages. */
export const log = {
  info: (msg: string) => process.stderr.write(`[kb-hub] ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[kb-hub] error: ${msg}\n`),
};
