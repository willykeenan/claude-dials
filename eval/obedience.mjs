#!/usr/bin/env node
// Behavioral-obedience eval — does setting a dial actually change Claude's output?
//
// This is the eval the audit said was missing: prior tests prove the server speaks
// MCP correctly (transport); this proves the dials CHANGE BEHAVIOR (obedience). For
// each task it renders the REAL dials instruction block (src/logic.mjs renderCurrent)
// with the target dial at LOW vs HIGH, prepends it to a neutral prompt, and measures
// a deterministic signal (eval/judge.mjs) that should move in the dial's direction.
//
//   default (mock)   canned terse/thorough responses — hermetic, free, gates CI,
//                    and proves the JUDGE discriminates. NOT an eval of the model.
//   --live           real Claude via the Anthropic SDK (needs ANTHROPIC_API_KEY,
//                    costs money) — the real obedience eval of the model.
//
// Gate: every task's effect must be in the promised direction (normalized delta
// >= --min-effect). A dial that doesn't move behavior fails the gate.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { renderCurrent } from "../src/logic.mjs";
import { DEFAULTS } from "../src/dials.mjs";
import { TASKS, MOCK } from "./tasks.mjs";
import { effect } from "./judge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOW = 1, HIGH = 9;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const LIVE = has("--live");
const MIN_EFFECT = Number(val("--min-effect", "0.15"));
const REPORT = val("--report", null);

// Build the exact instruction block the server serves, with `dial` pinned to `value`.
function dialsBlock(dial, value) {
  const values = { ...DEFAULTS, [dial]: value };
  return renderCurrent({ values, activePreset: "custom", updatedAt: null });
}

async function liveComplete(system, prompt) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const r = await client.messages.create({
    model: process.env.DIALS_EVAL_MODEL || "claude-sonnet-4-5",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function responsesFor(task) {
  if (!LIVE) return { low: MOCK[task.id].low, high: MOCK[task.id].high };
  const low = await liveComplete(dialsBlock(task.dial, LOW), task.prompt);
  const high = await liveComplete(dialsBlock(task.dial, HIGH), task.prompt);
  return { low, high };
}

async function main() {
  if (LIVE && !process.env.ANTHROPIC_API_KEY) {
    console.error("--live requires ANTHROPIC_API_KEY (this spends money)");
    process.exit(2);
  }
  const rows = [];
  for (const task of TASKS) {
    const { low, high } = await responsesFor(task);
    const e = effect(task.metric, low, high);
    const pass = e.normalized >= MIN_EFFECT;
    rows.push({ id: task.id, dial: task.dial, metric: task.metric, ...e, pass });
  }

  const passed = rows.filter((r) => r.pass).length;
  const meanEffect = rows.reduce((s, r) => s + r.normalized, 0) / rows.length;

  const mode = LIVE ? `LIVE (${process.env.DIALS_EVAL_MODEL || "claude-sonnet-4-5"})` : "mock (hermetic)";
  console.log(`\nclaude-dials — behavioral-obedience eval [${mode}]`);
  console.log(`dial swing: ${LOW} → ${HIGH}, min normalized effect: ${MIN_EFFECT}\n`);
  for (const r of rows) {
    const mark = r.pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${mark} ${r.id.padEnd(20)} ${r.dial.padEnd(13)} low=${r.low}  high=${r.high}  Δ=${r.delta}  norm=${r.normalized.toFixed(2)}`);
  }
  console.log(`\n${passed}/${rows.length} dials moved behavior in the promised direction; mean effect ${meanEffect.toFixed(2)}`);

  if (REPORT) {
    const md = [
      "# claude-dials — Behavioral-Obedience Eval", "",
      `**Mode:** ${mode}  |  **Dial swing:** ${LOW} → ${HIGH}  |  **Pass:** ${passed}/${rows.length}  |  **Mean effect:** ${meanEffect.toFixed(2)}`, "",
      "> Each row prepends the real rendered dials block with one dial at low vs high, then measures a deterministic signal that should track that dial. Positive normalized Δ = the model moved in the direction the dial promises.", "",
      "| task | dial | metric | low | high | Δ | normalized | pass |",
      "|---|---|---|---:|---:|---:|---:|:--:|",
      ...rows.map((r) => `| ${r.id} | ${r.dial} | ${r.metric} | ${r.low} | ${r.high} | ${r.delta} | ${r.normalized.toFixed(2)} | ${r.pass ? "✅" : "❌"} |`),
      "",
    ].join("\n");
    writeFileSync(join(__dirname, REPORT.startsWith("/") ? REPORT : `../${REPORT}`), md);
    console.log(`wrote report -> ${REPORT}`);
  }

  const failed = rows.filter((r) => !r.pass);
  if (failed.length) {
    console.log("\nOBEDIENCE GATE FAILED — dials that did not move behavior:");
    for (const r of failed) console.log(`  ✗ ${r.id} (${r.dial}): normalized effect ${r.normalized.toFixed(2)} < ${MIN_EFFECT}`);
    process.exit(1);
  }
  console.log("OBEDIENCE GATE PASSED ✅");
}

main().catch((e) => { console.error("eval error:", e.message); process.exit(2); });
