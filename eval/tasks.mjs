// Behavioral-obedience task suite. Each task pairs a neutral prompt with the dial
// it probes and the metric that should move when that dial goes from low to high.
// The eval prepends the REAL rendered dials block (from src/logic.mjs) so it tests
// the exact instruction the MCP server serves — not a paraphrase.

export const TASKS = [
  {
    id: "verbosity_explain",
    dial: "verbosity",
    metric: "verbosity",
    prompt: "Explain what a hash map is.",
  },
  {
    id: "verbosity_decision",
    dial: "verbosity",
    metric: "verbosity",
    prompt: "Should I use a REST API or GraphQL for a small internal tool?",
  },
  {
    id: "rigor_algo",
    dial: "rigor",
    metric: "rigor",
    prompt: "Write a function that returns the median of a list of numbers.",
  },
  {
    id: "rigor_review",
    dial: "rigor",
    metric: "rigor",
    prompt: "Review this line for problems: `const avg = nums.reduce((a,b)=>a+b)/nums.length`",
  },
  {
    id: "verification_fix",
    dial: "verification",
    metric: "verification",
    prompt: "Fix this: `function isEven(n){ return n % 2 }` and tell me it works.",
  },
  {
    id: "verbosity_debug",
    dial: "verbosity",
    metric: "verbosity",
    prompt: "What does HTTP 429 mean?",
  },
];

// Mock responses: a terse (low-dial) and a thorough (high-dial) canned answer per
// task. These are realistic LLM outputs used to (a) gate CI for free and (b) prove
// the judges DISCRIMINATE — the thorough answer must out-score the terse one on the
// task's metric. --live replaces these with real Claude calls. The mock is NOT the
// eval of the model; it is the eval of the measurement machinery.
export const MOCK = {
  verbosity_explain: {
    low: "A hash map stores key-value pairs with O(1) average lookup.",
    high: "A hash map (or hash table) is a data structure that stores key-value pairs and gives you average O(1) lookup, insert, and delete. It works by running each key through a hash function to pick a bucket. When two keys land in the same bucket that's a collision, resolved by chaining (a list per bucket) or open addressing (probing for the next free slot). The load factor — entries divided by buckets — drives performance; when it grows too high the table resizes and rehashes. Worst case degrades to O(n) if many keys collide, which is why a good hash function and resizing policy matter.",
  },
  verbosity_decision: {
    low: "Use REST — it's simpler for a small internal tool.",
    high: "For a small internal tool, REST is usually the better call. It's simpler to build and debug, every client and proxy understands it, and caching is trivial. GraphQL shines when you have many clients with divergent data needs or deeply nested graphs to fetch in one round trip — that flexibility costs you a schema layer, resolver plumbing, and harder caching. For a small internal tool the surface area is small and the team is small, so REST's simplicity wins; reach for GraphQL only if you already feel the pain of over- or under-fetching across several consumers.",
  },
  rigor_algo: {
    low: "def median(xs):\n    xs = sorted(xs)\n    return xs[len(xs)//2]",
    high: "def median(xs):\n    if not xs:\n        raise ValueError('median of empty list')\n    s = sorted(xs)\n    n = len(s)\n    mid = n // 2\n    # even length is an edge case: average the two middle values\n    if n % 2 == 0:\n        return (s[mid-1] + s[mid]) / 2\n    return s[mid]\n\nConsider the edge cases: an empty list (raise), a single element, and even vs odd length. An alternative is quickselect for O(n) average time if sorting is a bottleneck, though for typical inputs sorted() is fine. One caveat: this assumes numeric, comparable input.",
  },
  rigor_review: {
    low: "Looks fine — it averages the numbers.",
    high: "There are a few problems. Edge case: if `nums` is empty, `reduce` with no initial value throws 'Reduce of empty array with no initial value', and dividing by `nums.length` (0) would give NaN anyway. However, even for non-empty input the missing initial value is fragile — pass `0` as the seed: `nums.reduce((a,b)=>a+b, 0)/nums.length`. Consider also the failure mode of non-numeric elements, which silently produce NaN. Trade-off: guarding every case adds noise; at minimum handle the empty-array boundary.",
  },
  verification_fix: {
    low: "function isEven(n){ return n % 2 === 0 } — that works.",
    high: "The bug: `n % 2` returns 1 (truthy) for odds and 0 (falsy) for evens, and it's not even a boolean. Fixed:\n```js\nfunction isEven(n){ return n % 2 === 0 }\n```\nLet me verify with a few test cases: isEven(2) → true, isEven(3) → false, isEven(0) → true, isEven(-4) → true. I ran these and each matches the expected output, so the fix checks out. One thing to test at the boundary: non-integer input like 2.5 returns false, which is the sane result.",
  },
  verbosity_debug: {
    low: "Too many requests — slow down.",
    high: "HTTP 429 means the server is rate-limiting you: you sent more requests than the quota allows in a window. Typical fixes are backoff with Retry-After, cache responses, batch work, or raise the plan limit. It's a client-side throttle signal, not a bug in your auth, unless you're accidentally looping.",
  },
};
