// Pure state logic — no I/O. Shared by every storage backend (local file,
// Supabase, or anything else). A "state" is { values, activePreset, updatedAt }.

import { DIALS, DIAL_NAMES, DEFAULTS, PRESETS, PRESET_NAMES, bandFor, dialByName } from "./dials.mjs";

export function emptyState() {
  return { values: { ...DEFAULTS }, activePreset: "default", updatedAt: null };
}

// Sanitize an untrusted values object: keep only known dials with in-range integers.
export function sanitizeValues(raw) {
  const values = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const name of DIAL_NAMES) {
      const v = raw[name];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10) {
        values[name] = Math.round(v);
      }
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
  return { ok: true, num: Math.round(num) };
}

export function validatePreset(name) {
  if (!PRESET_NAMES.includes(name)) {
    return { ok: false, error: `Unknown preset "${name}". Valid presets: ${PRESET_NAMES.join(", ")}.` };
  }
  return { ok: true };
}

// Extreme dials get called out first so the model sees the binding constraints
// before the full table (models overweight early instructions).
function extremeRules(state) {
  const rules = [];
  for (const d of DIALS) {
    const v = state.values[d.name];
    if (v <= 2 || v >= 8) {
      rules.push(`- **${d.label} ${v}/10 (binding):** ${bandFor(d, v)}`);
    }
  }
  return rules;
}

// Render the current dials as a Markdown instruction block — the text Claude reads.
// Written as hard operating constraints, not soft suggestions: models under-weight
// "please consider" language and over-weight numbered MUST/MUST NOT rules.
export function renderCurrent(state) {
  const lines = [];
  lines.push("# Operating dials — follow for this session");
  lines.push("");
  lines.push(`Active preset: **${state.activePreset}**${state.updatedAt ? ` · updated ${state.updatedAt}` : ""}`);
  lines.push("");
  lines.push("## Rules (mandatory)");
  lines.push("1. These dials are **binding operating constraints**, not vibes. Honor the exact value.");
  lines.push("2. Higher is **not** always better — a low dial is as mandatory as a high one.");
  lines.push("3. If two dials pull opposite ways, obey **both** (e.g. high rigor + low verbosity = deep work, short reply).");
  lines.push("4. Before claiming work is done, re-check the Verification and Self-review bands.");
  lines.push("");

  const extremes = extremeRules(state);
  if (extremes.length) {
    lines.push("## Binding extremes (priority)");
    lines.push(...extremes);
    lines.push("");
  }

  lines.push("## Full dial board");
  lines.push("");
  lines.push("| Dial | Value | You MUST |");
  lines.push("|---|---|---|");
  for (const d of DIALS) {
    const v = state.values[d.name];
    lines.push(`| ${d.label} | **${v}**/10 | ${bandFor(d, v)} |`);
  }
  lines.push("");
  lines.push("_Change with `set_dial` / `apply_preset`, or ask in plain language._");
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
// Optional store.update(mutator, stamp) runs load+mutate+save under one lock (serial store).

export async function opSetDial(store, name, value, stamp) {
  const v = validateDial(name, value);
  if (!v.ok) return { ok: false, error: v.error };
  if (typeof store.update === "function") {
    const saved = await store.update((state) => {
      state.values[name] = v.num;
      state.activePreset = "custom";
      return state;
    }, stamp);
    return { ok: true, state: saved };
  }
  const state = await store.load();
  state.values[name] = v.num;
  state.activePreset = "custom";
  const saved = await store.save(state, stamp);
  return { ok: true, state: saved };
}

export async function opApplyPreset(store, name, stamp) {
  const v = validatePreset(name);
  if (!v.ok) return { ok: false, error: v.error };
  if (typeof store.update === "function") {
    const saved = await store.update(() => presetState(name), stamp);
    return { ok: true, state: saved };
  }
  const saved = await store.save(presetState(name), stamp);
  return { ok: true, state: saved };
}

export async function opReset(store, stamp) {
  return opApplyPreset(store, "default", stamp);
}
