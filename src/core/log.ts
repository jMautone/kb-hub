import { appendFile, open, readFile } from "node:fs/promises";
import { join } from "node:path";

export type LogEntry = {
  /** The date in the heading, `YYYY-MM-DD`, or null when the heading has none. */
  date: string | null;
  /** The heading after the date, for example `capture | Coupon applied twice on retry`. */
  title: string;
  /** The lines under the heading, trimmed. Empty when there are none. */
  details: string;
};

/** Last byte of a file, or undefined when it is missing or empty. */
async function lastByte(file: string): Promise<number | undefined> {
  let handle;
  try {
    handle = await open(file, "r");
  } catch {
    return undefined;
  }
  try {
    const { size } = await handle.stat();
    if (size === 0) return undefined;
    const buf = Buffer.alloc(1);
    await handle.read(buf, 0, 1, size - 1);
    return buf[0];
  } finally {
    await handle.close();
  }
}

/**
 * Appends one entry to log.md, separated from the previous one by a blank line.
 * Opens the file in append mode, so earlier entries are never rewritten.
 */
export async function appendLog(vault: string, entry: string): Promise<void> {
  const file = join(vault, "log.md");
  const body = entry.replace(/\r\n/g, "\n").replace(/\n*$/, "\n");
  const last = await lastByte(file);
  const separator = last === undefined ? "" : last === 0x0a ? "\n" : "\n\n";
  await appendFile(file, `${separator}${body}`, "utf8");
}

/** Parses log.md into entries, oldest first. Entries are `## ` headings; text before the first one is ignored. */
export function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: { heading: string; lines: string[] } | undefined;
  const flush = () => {
    if (!current) return;
    const dated = /^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/.exec(current.heading);
    entries.push({
      date: dated ? dated[1]! : null,
      title: (dated ? dated[2]! : current.heading).trim(),
      details: current.lines.join("\n").trim(),
    });
  };
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      current = { heading: heading[1]!.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return entries;
}

/** The last `count` entries of log.md, newest first. Empty when the log is missing. */
export async function recentLog(vault: string, count = 5): Promise<LogEntry[]> {
  let text: string;
  try {
    text = await readFile(join(vault, "log.md"), "utf8");
  } catch {
    return [];
  }
  return parseLog(text).slice(-count).reverse();
}
