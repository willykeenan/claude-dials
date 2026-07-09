#!/usr/bin/env node
// Streamable HTTP transport for remote use (claude.ai custom connectors).
// POST /mcp  { JSON-RPC } -> JSON-RPC response (or 202 for notifications).
// GET  /mcp  -> 405 (no server-initiated stream needed for this stateless server).
// Zero dependencies: Node's built-in http + crypto only.

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { handleMessage } from "./mcp.mjs";
import { createFileStore } from "./store.mjs";
import { createSerialStore } from "./serial.mjs";

const PORT = Number(process.env.PORT || 8787);
const PATH = process.env.MCP_PATH || "/mcp";
const TOKEN = process.env.DIALS_TOKEN;
const MAX_BODY = 1e6; // 1 MB
const store = createSerialStore(createFileStore());

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id, mcp-protocol-version, authorization");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
}

// Constant-time token check. Different-length inputs short-circuit to false
// without leaking timing about the real token's length beyond that.
function tokenOk(header) {
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

// In open mode (no token) refuse browser-originated cross-site calls so a
// malicious web page can't drive a user's local server (DNS-rebinding / CSRF).
function localOriginOnly(origin) {
  if (!origin) return true; // server-to-server MCP clients send no Origin
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch { return false; }
}

const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const path = req.url.split("?")[0];
  if (path === "/health") return json(res, 200, { ok: true, server: "claude-dials" });
  if (path !== PATH) { res.writeHead(404); return res.end("Not found"); }

  if (TOKEN) {
    if (!tokenOk(req.headers["authorization"] || "")) return json(res, 401, { error: "unauthorized" });
  } else if (!localOriginOnly(req.headers["origin"])) {
    return json(res, 403, { error: "forbidden: set DIALS_TOKEN to allow remote/browser access" });
  }

  if (req.method !== "POST") { res.writeHead(405); return res.end("Method Not Allowed"); }

  // DoS-safe body read: bounded buffer, single terminal response, no write after abort.
  const chunks = [];
  let size = 0, aborted = false;
  req.on("data", (c) => {
    if (aborted) return;
    size += c.length;
    if (size > MAX_BODY) { aborted = true; json(res, 413, { error: "payload too large" }); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("error", () => { aborted = true; });
  req.on("end", async () => {
    if (aborted || res.writableEnded) return;
    let msg;
    try { msg = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return json(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }

    const ctx = { store, stamp: new Date().toISOString() };
    if (Array.isArray(msg)) {
      if (msg.length === 0) return json(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request: empty batch" } });
      // Sequential: parallel batch on a shared store can lose dial updates.
      const outs = [];
      for (const m of msg) {
        const o = await handleMessage(m, ctx);
        if (o) outs.push(o);
      }
      return json(res, 200, outs);
    }
    const out = await handleMessage(msg, ctx);
    if (out == null) { res.writeHead(202); return res.end(); } // notification: no body
    json(res, 200, out);
  });
});

server.listen(PORT, () => {
  process.stderr.write(`claude-dials MCP server (http) on :${PORT}${PATH}${TOKEN ? " [token required]" : " [open — local origins only]"}\n`);
});
