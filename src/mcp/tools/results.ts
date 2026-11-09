/** A tool result the agent sees as an error, with a readable message. */
export function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
