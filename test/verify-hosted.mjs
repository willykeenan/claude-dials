#!/usr/bin/env node
// Hosted-path verification against REAL Supabase. Proves the multi-tenant store:
// per-token isolation + cross-request persistence, driven through the MCP core
// exactly as the serverless function does. Needs SUPABASE_URL + SUPABASE_KEY.

import { randomBytes, createHash } from "node:crypto";
import { handleMessage } from "../src/mcp.mjs";
import { createSupabaseStore } from "../src/store-supabase.mjs";

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("set SUPABASE_URL and SUPABASE_KEY"); process.exit(2); }

const hash = (t) => createHash("sha256").update(t).digest("hex");
const storeFor = (t) => createSupabaseStore({ url: SUPABASE_URL, key: SUPABASE_KEY, tokenHash: hash(t) });
const call = (store, method, params) => handleMessage({ jsonrpc: "2.0", id: 1, method, params }, { store, stamp: new Date().toISOString() });
const textOf = (r) => r.result?.content?.[0]?.text || "";

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log(`  \x1b[32m✓\x1b[0m ${n}`)) : (fail++, console.log(`  \x1b[31m✗ ${n}\x1b[0m`)); };

const tokenA = "dk_" + randomBytes(16).toString("hex");
const tokenB = "dk_" + randomBytes(16).toString("hex");
const A = storeFor(tokenA), B = storeFor(tokenB);

try {
  console.log("claude-dials — hosted (Supabase) verification\n");

  const init = await call(A, "initialize", { protocolVersion: "2025-06-18" });
  check("initialize over hosted store", init.result?.serverInfo?.name === "claude-dials");

  const g0 = await call(A, "tools/call", { name: "get_dials", arguments: {} });
  check("new token A starts at default Rigor 6", /Rigor \| \*\*6\*\*/.test(textOf(g0)));

  const s1 = await call(A, "tools/call", { name: "set_dial", arguments: { dial: "rigor", value: 9 } });
  check("A set_dial rigor=9 ok", s1.result?.isError === false);

  // fresh store object for the SAME token — proves it persisted in the DB, not memory
  const g1 = await call(storeFor(tokenA), "tools/call", { name: "get_dials", arguments: {} });
  check("A rigor=9 persisted across a fresh store (DB-backed)", /Rigor \| \*\*9\*\*/.test(textOf(g1)));

  const gB = await call(B, "tools/call", { name: "get_dials", arguments: {} });
  check("token B is isolated — still default Rigor 6 (not A's 9)", /Rigor \| \*\*6\*\*/.test(textOf(gB)));

  const p = await call(A, "tools/call", { name: "apply_preset", arguments: { preset: "careful" } });
  check("A apply_preset careful ok", p.result?.isError === false);
  const g2 = await call(storeFor(tokenA), "tools/call", { name: "get_dials", arguments: {} });
  check("careful preset set A Autonomy to 2", /Autonomy \| \*\*2\*\*/.test(textOf(g2)));

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m`);
  console.log(`\ncleanup hashes:\n  ${hash(tokenA)}\n  ${hash(tokenB)}`);
} catch (e) {
  console.error("\x1b[31mHARNESS ERROR:\x1b[0m", e.message); fail++;
}
process.exit(fail === 0 ? 0 : 1);
