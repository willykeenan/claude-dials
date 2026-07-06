// Pure state logic — no I/O. Shared by every storage backend (local file,
// Supabase, or anything else). A "state" is { values, activePreset, updatedAt }.

import { DIALS, DIAL_NAMES, DEFAULTS, PRESETS, PRESET_NAMES, bandFor, dialByName } from "./dials.mjs";

export function emptyState() {
  return { values: { ...DEFAULTS }, activePreset: "default", updatedAt: null };
}

// Sanitize an untrusted values object: keep only known dials with in-range numbers.
export function sanitizeValues(raw) {
  const values = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const name of DIAL_NAMES) {
      const v = raw[name];
      if (typeof v === "number" && v >= 0 && v <= 10) values[name] = v;
    }
  }
  return values;
}

export function presetState(name) {
  return { values: { ...PRESETS[name].values }, activePreset: name, updatedAt: null };
}

export function validateDial(name, value) {
  if (!DIAL_NAMES.includes(name)) {
    return { ok: false, error: `Unknown dial "${name}". Valid dials: ${DIAL_NAMES.join(", ")}.` };
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 10) {
    return { ok: false, error: `Value must be a number 0–10 (got ${JSON.stringify(value)}).` };
  }
  return { ok: true, num };
}

export function validatePreset(name) {
  if (!PRESET_NAMES.includes(name)) {
    return { ok: false, error: `Unknown preset "${name}". Valid presets: ${PRESET_NAMES.join(", ")}.` };
  }
  return { ok: true };
}

// Render the current dials as a Markdown instruction block — the text Claude reads.
export function renderCurrent(state) {
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

export function explainDial(name, state) {
  const d = dialByName(name);
  if (!d) return { ok: false, error: `Unknown dial "${name}". Valid: ${DIAL_NAMES.join(", ")}.` };
  const v = state.values[d.name];
  const rows = d.bands.map(([r, t]) => `| ${r} | ${t} |`).join("\n");
  const text =
    `## ${d.label} — currently **${v}**/10\n` +
    `Scale: 0 = ${d.low} · 10 = ${d.high}\n` +
    `Drives: ${d.drives}\n\n` +
    `| Band | Behavior |\n|---|---|\n${rows}`;
  return { ok: true, text };
}

// ---- store-agnostic operations -----------------------------------------
// A "store" is any object with async load() -> state and async save(state, stamp) -> state.

export async function opSetDial(store, name, value, stamp) {
  const v = validateDial(name, value);
  if (!v.ok) return { ok: false, error: v.error };
  const state = await store.load();
  state.values[name] = v.num;
  state.activePreset = "custom";
  const saved = await store.save(state, stamp);
  return { ok: true, state: saved };
}

export async function opApplyPreset(store, name, stamp) {
  const v = validatePreset(name);
  if (!v.ok) return { ok: false, error: v.error };
  const saved = await store.save(presetState(name), stamp);
  return { ok: true, state: saved };
}

export async function opReset(store, stamp) {
  return opApplyPreset(store, "default", stamp);
}
