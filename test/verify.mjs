#!/usr/bin/env node
// End-to-end verification. Spawns the real stdio server as a child process and
// drives it over JSON-RPC exactly as Claude Code would. Uses an isolated temp
// state file so it's repeatable and never touches real settings.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "src", "stdio.mjs");
const STATE = join(tmpdir(), `claude-dials-test-${process.pid}.json`);
try { rmSync(STATE, { force: true }); } catch {}

const child = spawn(process.execPath, [SERVER], {
  env: { ...process.env, DIALS_STATE_FILE: STATE },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.on("data", () => {}); // swallow the "ready" banner

let buf = "";
const pending = new Map();
const allMsgs = [];
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    allMsgs.push(msg);
    if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});

let idc = 0;
function rpc(method, params) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout on ${method}`)), 10000);
    pending.set(id, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m`); }
}
const textOf = (r) => r.result?.content?.[0]?.text || "";

try {
  console.log("claude-dials — end-to-end verification\n");

  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "0" } });
  check("initialize returns a supported protocolVersion", ["2024-11-05", "2025-03-26", "2025-06-18"].includes(init.result?.protocolVersion));
  check("serverInfo.name is claude-dials", init.result?.serverInfo?.name === "claude-dials");
  check("advertises tools + resources + prompts", !!init.result?.capabilities?.tools && !!init.result?.capabilities?.resources && !!init.result?.capabilities?.prompts);
  notify("notifications/initialized");

  const ping = await rpc("ping", {});
  check("ping returns empty result", ping.result && Object.keys(ping.result).length === 0);

  const tools = await rpc("tools/list", {});
  const tnames = (tools.result?.tools || []).map((t) => t.name);
  for (const need of ["get_dials", "set_dial", "apply_preset", "list_presets", "explain_dial", "reset_dials"])
    check(`tools/list exposes ${need}`, tnames.includes(need));
  check("every tool has an inputSchema", (tools.result?.tools || []).every((t) => t.inputSchema?.type === "object"));

  const res = await rpc("resources/list", {});
  const uris = (res.result?.resources || []).map((r) => r.uri);
  check("resources/list exposes dials://current", uris.includes("dials://current"));
  check("resources/list exposes dials://schema", uris.includes("dials://schema"));

  const prompts = await rpc("prompts/list", {});
  check("prompts/list exposes load-dials", (prompts.result?.prompts || []).some((p) => p.name === "load-dials"));

  await rpc("tools/call", { name: "reset_dials", arguments: {} });
  const get1 = await rpc("tools/call", { name: "get_dials", arguments: {} });
  check("get_dials shows Rigor at default 6", /Rigor \| \*\*6\*\*\/10/.test(textOf(get1)));
  check("get_dials uses binding/mandatory framing", /binding|MUST|mandatory/i.test(textOf(get1)));

  const set1 = await rpc("tools/call", { name: "set_dial", arguments: { dial: "rigor", value: 9 } });
  check("set_dial rigor=9 succeeds (not isError)", set1.result?.isError === false && textOf(set1).includes("rigor → 9"));

  const get2 = await rpc("tools/call", { name: "get_dials", arguments: {} });
  check("set_dial persisted (get_dials now shows Rigor 9)", /Rigor \| \*\*9\*\*\/10/.test(textOf(get2)));
  check("high rigor surfaces in binding extremes", /Rigor 9\/10 \(binding\)/.test(textOf(get2)));

  const preset = await rpc("tools/call", { name: "apply_preset", arguments: { preset: "fable" } });
  check("apply_preset fable succeeds", preset.result?.isError === false && textOf(preset).toLowerCase().includes("fable"));
  const get3 = await rpc("tools/call", { name: "get_dials", arguments: {} });
  check("fable preset sets Verification to 9", /Verification \| \*\*9\*\*\/10/.test(textOf(get3)));

  const bad1 = await rpc("tools/call", { name: "set_dial", arguments: { dial: "bogus", value: 3 } });
  check("set_dial rejects unknown dial (isError + message)", bad1.result?.isError === true && /Unknown dial/.test(textOf(bad1)));
  const bad2 = await rpc("tools/call", { name: "set_dial", arguments: { dial: "rigor", value: 99 } });
  check("set_dial rejects out-of-range value", bad2.result?.isError === true && /0–10/.test(textOf(bad2)));

  const readCur = await rpc("resources/read", { uri: "dials://current" });
  check("resources/read dials://current returns markdown", /Operating dials|Full dial board/.test(readCur.result?.contents?.[0]?.text || ""));
  const readSchema = await rpc("resources/read", { uri: "dials://schema" });
  let schemaOk = false;
  try { schemaOk = JSON.parse(readSchema.result.contents[0].text).dials.length === 8; } catch {}
  check("resources/read dials://schema is valid JSON with 8 dials", schemaOk);

  const promptGet = await rpc("prompts/get", { name: "load-dials" });
  check("prompts/get load-dials returns a user message", promptGet.result?.messages?.[0]?.role === "user");

  const unknown = await rpc("frobnicate", {});
  check("unknown method returns -32601", unknown.error?.code === -32601);

  // Regression: a notification (no id) must produce NO response. Send one, then a
  // normal request; if the notification wrongly replied it would surface as an
  // id:null result frame.
  notify("ping");
  await rpc("ping", {});
  check("notification (ping without id) yields no response frame", !allMsgs.some((m) => m.id === null && m.result !== undefined));

  const nonObj = await rpc("tools/call", { name: "get_dials", arguments: 123 });
  check("non-object arguments are tolerated (coerced, not crashed)", nonObj.result?.isError === false);

  // ---- schema enforcement at the protocol layer (hardening) ----
  const extra = await rpc("tools/call", { name: "set_dial", arguments: { dial: "rigor", value: 5, sneaky: true } });
  check("set_dial rejects unknown property with -32602", extra.error?.code === -32602 && /sneaky/.test(extra.error?.message || ""));
  const missing = await rpc("tools/call", { name: "set_dial", arguments: { value: 5 } });
  check("set_dial rejects missing required 'dial' with -32602", missing.error?.code === -32602 && /dial/.test(missing.error?.message || ""));
  const wrongType = await rpc("tools/call", { name: "set_dial", arguments: { dial: "rigor", value: "nine" } });
  check("set_dial rejects wrong-typed value with -32602", wrongType.error?.code === -32602);
  // domain errors still surface as friendly isError (NOT -32602), so the model can self-correct
  const domain = await rpc("tools/call", { name: "set_dial", arguments: { dial: "rigor", value: 99 } });
  check("out-of-range value stays a friendly isError tool-result", domain.result?.isError === true && /0–10/.test(textOf(domain)));

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m`);
} catch (e) {
  console.error("\x1b[31mHARNESS ERROR:\x1b[0m", e.message);
  fail++;
} finally {
  child.stdin.end();
  child.kill();
  try { rmSync(STATE, { force: true }); } catch {}
  process.exit(fail === 0 ? 0 : 1);
}
