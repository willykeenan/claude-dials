// Hosted MCP connector endpoint (Vercel serverless function).
// POST /api/mcp  { JSON-RPC } -> JSON-RPC response.
// Auth: the caller's bearer token IS their workspace id. We store only its
// sha256, so a DB leak never exposes tokens. One token = one private set of dials.

import { createHash } from "node:crypto";
import { handleMessage } from "../src/mcp.mjs";
import { createSupabaseStore } from "../src/store-supabase.mjs";
import { baseUrl } from "../src/oauth.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, mcp-session-id, mcp-protocol-version");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      return resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    }
    let data = "", size = 0;
    req.on("data", (c) => { size += c.length; if (size > 1e6) { req.destroy(); reject(new Error("too large")); } else data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method === "GET") { res.status(200).json({ ok: true, server: "claude-dials", hosted: true }); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  if (!SUPABASE_URL || !SUPABASE_KEY) { res.status(500).json({ error: "server misconfigured" }); return; }

  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    // Point OAuth-capable clients (claude.ai) at our resource metadata so they
    // can discover the authorization server and run the flow.
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`);
    res.status(401).json({ error: "authentication required", authorize: `${baseUrl(req)}/.well-known/oauth-protected-resource` });
    return;
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const store = createSupabaseStore({ url: SUPABASE_URL, key: SUPABASE_KEY, tokenHash });

  let msg;
  try { msg = JSON.parse(await readBody(req)); }
  catch { res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); return; }

  const ctx = { store, stamp: new Date().toISOString() };
  try {
    if (Array.isArray(msg)) {
      if (msg.length === 0) { res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "empty batch" } }); return; }
      const outs = (await Promise.all(msg.map((m) => handleMessage(m, ctx)))).filter(Boolean);
      res.status(200).json(outs);
      return;
    }
    const out = await handleMessage(msg, ctx);
    if (out == null) { res.status(202).end(); return; } // notification
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32603, message: String(e.message || e) } });
  }
}
