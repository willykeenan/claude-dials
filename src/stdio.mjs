#!/usr/bin/env node
// stdio transport: newline-delimited JSON-RPC over stdin/stdout.
// This is what Claude Code and Claude Desktop launch. Nothing but protocol
// messages may go to stdout; diagnostics go to stderr.

import { handleMessage } from "./mcp.mjs";
import { createFileStore } from "./store.mjs";
import { createSerialStore } from "./serial.mjs";

const store = createSerialStore(createFileStore());
const MAX_LINE = 4_000_000; // guard against an unterminated, ever-growing line
let buf = "";
process.stdin.setEncoding("utf8");

function send(obj) {
  if (obj == null) return;
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  try {
    send(await handleMessage(msg, { store, stamp: new Date().toISOString() }));
  } catch (e) {
    send({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32603, message: e.message } });
  }
}

// Serialize line processing so state read-modify-write stays ordered.
let chain = Promise.resolve();
process.stdin.on("data", (chunk) => {
  buf += chunk;
  if (buf.length > MAX_LINE && buf.indexOf("\n") === -1) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Message too large" } });
    buf = "";
    return;
  }
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    chain = chain.then(() => handleLine(line));
  }
});

process.stdin.on("end", () => process.exit(0));
process.stderr.write("claude-dials MCP server (stdio) ready\n");
