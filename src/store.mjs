// State persistence + resolution. State lives at ~/.claude-dials/state.json
// (override with DIALS_STATE_FILE). Corrupt/missing state falls back to defaults
// rather than crashing — a config tool must never take down the client.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { DEFAULTS, DIAL_NAMES, PRESETS, PRESET_NAMES, DIALS, bandFor, dialByName } from "./dials.mjs";

const STATE_FILE = process.env.DIALS_STATE_FILE || join(homedir(), ".claude-dials", "state.json");

function emptyState() {
  return { values: { ...DEFAULTS }, activePreset: "default", updatedAt: null };
}

export function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return emptyState();
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    const values = { ...DEFAULTS };
    // Only accept known dials with in-range numeric values; ignore junk.
    if (raw && typeof raw.values === "object") {
      for (const name of DIAL_NAMES) {
        const v = raw.values[name];
        if (typeof v === "number" && v >= 0 && v <= 10) values[name] = v;
      }
    }
    return {
      values,
      activePreset: typeof raw?.activePreset === "string" ? raw.activePreset : "custom",
      updatedAt: raw?.updatedAt ?? null,
    };
  } catch {
    return emptyState();
  }
}

// `stamp` is injected so the module stays free of nondeterministic time at import.
// Wraps I/O so a filesystem error (readonly FS, permission denied) surfaces as a
// clean message — never a raw error that leaks the absolute state-file path.
export function saveState(state, stamp) {
  const out = { ...state, updatedAt: stamp ?? state.updatedAt ?? null };
  try {
    mkdirSync(join(STATE_FILE, ".."), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(out, null, 2));
  } catch {
    throw new Error("could not persist dial state (filesystem not writable)");
  }
  return out;
}

export function setDial(name, value, stamp) {
  if (!DIAL_NAMES.includes(name)) {
    return { ok: false, error: `Unknown dial "${name}". Valid dials: ${DIAL_NAMES.join(", ")}.` };
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 10) {
    return { ok: false, error: `Value must be a number 0–10 (got ${JSON.stringify(value)}).` };
  }
  const state = loadState();
  state.values[name] = num;
  state.activePreset = "custom";
  const saved = saveState(state, stamp);
  return { ok: true, state: saved };
}

export function applyPreset(name, stamp) {
  if (!PRESET_NAMES.includes(name)) {
    return { ok: false, error: `Unknown preset "${name}". Valid presets: ${PRESET_NAMES.join(", ")}.` };
  }
  const state = { values: { ...PRESETS[name].values }, activePreset: name, updatedAt: null };
  const saved = saveState(state, stamp);
  return { ok: true, state: saved };
}

export function resetDials(stamp) {
  return applyPreset("default", stamp);
}

// Render the current dials as a Markdown instruction block — this is the text
// Claude reads to know how to behave. Kept human-legible on purpose.
export function renderCurrent(state = loadState()) {
  const lines = [];
  lines.push("# Current Dials");
  lines.push("");
  lines.push(`Active preset: **${state.activePreset}**${state.updatedAt ? ` · updated ${state.updatedAt}` : ""}`);
  lines.push("");
  lines.push("> Protocol: follow these settings for this session. Each dial's band below is a concrete instruction. Higher is not always better — honor the value.");
  lines.push("");
  lines.push("| Dial | Value | Behavior at this setting |");
  lines.push("|---|---|---|");
  for (const d of DIALS) {
    const v = state.values[d.name];
    lines.push(`| ${d.label} | **${v}**/10 | ${bandFor(d, v)} |`);
  }
  lines.push("");
  lines.push("_Change with the `set_dial` or `apply_preset` tools, or ask in plain language._");
  return lines.join("\n");
}

export function explainDial(name) {
  const d = dialByName(name);
  if (!d) return { ok: false, error: `Unknown dial "${name}". Valid: ${DIAL_NAMES.join(", ")}.` };
  const state = loadState();
  const v = state.values[d.name];
  const rows = d.bands.map(([r, t]) => `| ${r} | ${t} |`).join("\n");
  const text =
    `## ${d.label} — currently **${v}**/10\n` +
    `Scale: 0 = ${d.low} · 10 = ${d.high}\n` +
    `Drives: ${d.drives}\n\n` +
    `| Band | Behavior |\n|---|---|\n${rows}`;
  return { ok: true, text };
}
