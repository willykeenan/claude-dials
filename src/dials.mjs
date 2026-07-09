// Dials — the behavior schema. Pure data, no side effects.
// Each dial is a 0–10 slider that tunes how Claude works. The `bands` map value
// ranges to concrete behavior so the model has an unambiguous instruction.

export const DIALS = [
  {
    name: "rigor",
    label: "Rigor",
    low: "quick first-pass",
    high: "exhaustive reasoning",
    default: 6,
    drives: "reasoning effort + willingness to enumerate edge cases and multi-step",
    bands: [
      ["0-3", "MUST: first workable answer only. Skip edge-case tours. Do not over-engineer."],
      ["4-6", "MUST: solid main path; note the 1–2 most likely failure modes, nothing more."],
      ["7-8", "MUST: enumerate edge cases and at least one alternative; weigh tradeoffs before deciding."],
      ["9-10", "MUST: exhaustive breakdown — list assumptions, failure modes, alternatives, and why you chose this. Assume nothing."],
    ],
  },
  {
    name: "context_depth",
    label: "Context depth",
    low: "act on the prompt alone",
    high: "read the full surrounding context first",
    default: 6,
    drives: "how much I read/trace before acting",
    bands: [
      ["0-3", "MUST: act on the prompt alone. Do not open extra files unless blocked."],
      ["4-6", "MUST: read only the files directly named or obviously required."],
      ["7-8", "MUST: before editing, read callers, callees, and local conventions."],
      ["9-10", "MUST: map adjacent modules, existing patterns, and recent history before any change."],
    ],
  },
  {
    name: "verification",
    label: "Verification",
    low: "assert it's done",
    high: "run it and show evidence",
    default: 6,
    drives: "proof before claiming done",
    bands: [
      ["0-3", "MUST: state the result. Do not run tests or commands unless asked."],
      ["4-6", "MUST: sanity-check the happy path (one quick check is enough)."],
      ["7-8", "MUST: run the relevant command/test; paste actual output for the main path + one edge."],
      ["9-10", "MUST: never say done without evidence. Run tests/commands and show outputs. If you cannot run, say so explicitly."],
    ],
  },
  {
    name: "self_review",
    label: "Self-review",
    low: "ship the first draft",
    high: "adversarial critique before delivering",
    default: 5,
    drives: "whether I critique my own work before handing it over",
    bands: [
      ["0-3", "MUST: ship the first draft. No second pass."],
      ["4-6", "MUST: one quick re-read for obvious mistakes, then ship."],
      ["7-8", "MUST: deliberate critique pass — ask 'how is this wrong?', fix findings, then deliver."],
      ["9-10", "MUST: adversarial self-attack (wrong inputs, races, security, silent failures). Only survivors ship; list what you checked."],
    ],
  },
  {
    name: "verbosity",
    label: "Verbosity",
    low: "one-liner",
    high: "exhaustive explanation",
    default: 3,
    drives: "how much I say back to you (NOT how hard I work)",
    bands: [
      ["0-2", "MUST: one-line verdict + result only. No preamble, no recap."],
      ["3-4", "MUST: verdict first, then ≤5 tight supporting lines. No essays."],
      ["5-7", "MUST: full explanation with reasoning, still scannable (headers/bullets ok)."],
      ["8-10", "MUST: exhaustive write-up — tradeoffs, alternatives, caveats, and when you'd choose otherwise."],
    ],
  },
  {
    name: "autonomy",
    label: "Autonomy",
    low: "ask before acting",
    high: "just do it, report after",
    default: 6,
    drives: "how much I confirm before acting",
    bands: [
      ["0-2", "MUST: propose the plan and wait. Do not edit/run/send until confirmed."],
      ["3-5", "MUST: confirm anything irreversible or outward-facing; proceed on local/reversible work."],
      ["6-8", "MUST: just do it and report after. Confirm only money, publish, delete, or secrets."],
      ["9-10", "MUST: full autonomy. Stop only for money movement or public launch."],
    ],
  },
  {
    name: "novelty",
    label: "Novelty",
    low: "proven patterns only",
    high: "bleeding-edge / experimental",
    default: 5,
    drives: "appetite for new tools/approaches (tech risk, not capital risk)",
    bands: [
      ["0-3", "MUST: boring proven stacks/patterns only. Reject experimental deps."],
      ["4-6", "MUST: mostly proven; at most one calculated new tool where payoff is clear."],
      ["7-8", "MUST: prefer modern/new approaches when they clearly win; accept some churn."],
      ["9-10", "MUST: experimental by default — try the frontier approach first, note risks."],
    ],
  },
  {
    name: "caution",
    label: "Caution",
    low: "move fast, low friction",
    high: "treat as if it will be reviewed",
    default: 5,
    drives: "care around claims, data, and irreversible actions",
    bands: [
      ["0-3", "MUST: minimize friction; ship fast. Skip formal risk notes."],
      ["4-6", "MUST: sensible checks; avoid obvious foot-guns."],
      ["7-8", "MUST: be explicit about risk on claims, data handling, and irreversible steps."],
      ["9-10", "MUST: review-grade posture (legal/security would read this). No speculative claims; flag residual risk."],
    ],
  },
];

export const DIAL_NAMES = DIALS.map((d) => d.name);

export const DEFAULTS = Object.fromEntries(DIALS.map((d) => [d.name, d.default]));

// Presets are named collections of dial values. `default` is the baseline.
export const PRESETS = {
  default: {
    description: "Balanced baseline.",
    values: { ...DEFAULTS },
  },
  fable: {
    description: "Maximum rigor. Read everything, verify with evidence, self-critique — terse replies, meticulous work.",
    values: { rigor: 9, context_depth: 9, verification: 9, self_review: 8, verbosity: 3, autonomy: 7, novelty: 3, caution: 6 },
  },
  ship: {
    description: "Move fast and autonomous. For low-stakes, high-velocity work.",
    values: { rigor: 5, context_depth: 4, verification: 6, self_review: 3, verbosity: 2, autonomy: 9, novelty: 4, caution: 3 },
  },
  careful: {
    description: "High-stakes mode: verify everything, ask before acting, max caution. For prod, money, or security-sensitive work.",
    values: { rigor: 7, context_depth: 7, verification: 9, self_review: 8, verbosity: 4, autonomy: 2, novelty: 2, caution: 9 },
  },
  explore: {
    description: "Research/prototyping: reach wide, read broadly, try new things.",
    values: { rigor: 7, context_depth: 8, verification: 6, self_review: 5, verbosity: 5, autonomy: 6, novelty: 9, caution: 4 },
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function dialByName(name) {
  return DIALS.find((d) => d.name === name);
}

export function bandFor(dial, value) {
  for (const [range, text] of dial.bands) {
    const [lo, hi] = range.split("-").map(Number);
    if (value >= lo && value <= hi) return text;
  }
  return dial.bands[dial.bands.length - 1][1];
}
