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
      ["0-3", "Fast, obvious solution. Low effort. Don't belabor it."],
      ["4-6", "Solid work; cover the main cases."],
      ["7-8", "High effort: enumerate edge cases, weigh alternatives."],
      ["9-10", "Exhaustive. Max effort. Assume nothing; break the problem down fully."],
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
      ["0-3", "Act on the prompt as given; minimal reading."],
      ["4-6", "Read the directly-relevant files."],
      ["7-8", "Read surrounding code, callers, and conventions before touching anything."],
      ["9-10", "Full context: adjacent modules, history, existing patterns — then act."],
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
      ["0-3", "State the result; no run."],
      ["4-6", "Sanity-check the happy path."],
      ["7-8", "Run it; test edge cases; report actual output."],
      ["9-10", "Run/test and show evidence before saying 'done'. Never claim unverified."],
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
      ["0-3", "Ship the first draft."],
      ["4-6", "Quick re-read for obvious mistakes."],
      ["7-8", "Deliberate critique pass: 'how is this wrong?' then revise."],
      ["9-10", "Adversarial: try hard to refute my own work; only survivors ship."],
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
      ["0-2", "One-line verdict + result only."],
      ["3-4", "Verdict first, then a few tight supporting lines."],
      ["5-7", "Full explanation with reasoning."],
      ["8-10", "Exhaustive: tradeoffs, alternatives, caveats."],
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
      ["0-2", "Confirm every action; propose and wait."],
      ["3-5", "Confirm anything outward-facing or irreversible; proceed on the rest."],
      ["6-8", "Just do it; report after. Confirm only money/publish/delete."],
      ["9-10", "Full autonomy; stop only for money movement or public launch."],
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
      ["0-3", "Boring, proven stacks and patterns; no surprises."],
      ["4-6", "Mostly proven; one calculated bet where it pays."],
      ["7-8", "Reach for new tools/approaches; accept some churn."],
      ["9-10", "Bleeding edge; experimental by default."],
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
      ["0-3", "Minimal friction; move fast."],
      ["4-6", "Sensible checks; avoid obvious trouble."],
      ["7-8", "Careful with claims and data; explicit about risk."],
      ["9-10", "Treat as if legal/security will review; strictest posture."],
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
