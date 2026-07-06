// Deterministic judges — score a model response on the axis a dial controls.
// No LLM-judge: every metric is a reproducible function of the text, so the
// eval's own numbers are trustworthy and the CI gate can't flake.

const words = (t) => (t.trim().match(/\S+/g) || []).length;

const countMatches = (t, re) => (t.match(re) || []).length;

// Rigor markers: signs of enumerating edge cases, alternatives, tradeoffs.
const RIGOR_RE = /\b(edge case|however|alternativ|consider|trade-?off|caveat|assumption|failure mode|what if|boundary|corner case|otherwise|on the other hand)\b/gi;
// Verification markers: signs of actually running/checking rather than asserting.
const VERIFY_RE = /\b(test|assert|verif|i ran|let me run|expected output|check that|reproduc|sanity)\b/gi;
const HAS_CODE = /```/;

export const JUDGES = {
  // higher score should track higher VERBOSITY dial
  verbosity(text) { return words(text); },
  // higher score should track higher RIGOR dial
  rigor(text) { return words(text) + 25 * countMatches(text, RIGOR_RE); },
  // higher score should track higher VERIFICATION dial
  verification(text) {
    return countMatches(text, VERIFY_RE) + (HAS_CODE.test(text) ? 3 : 0);
  },
};

// Effect: normalized delta between the high-dial and low-dial responses. Positive
// means the response moved in the direction the dial promises.
export function effect(metric, lowText, highText) {
  const judge = JUDGES[metric];
  const lo = judge(lowText);
  const hi = judge(highText);
  const denom = Math.max(1, Math.abs(lo));
  return { metric, low: lo, high: hi, delta: hi - lo, normalized: (hi - lo) / denom };
}
