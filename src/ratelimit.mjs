// Zero-dependency token-bucket rate limiter, keyed by client (IP or token hash).
//
// Scope note (honest): this is an in-process limiter. On a single long-lived
// process (the stdio/http transport) it is authoritative. On Vercel serverless
// it is per-instance, so it caps abuse per warm instance rather than globally —
// meaningful defense-in-depth and the correct zero-dep default, with the
// production upgrade being a Supabase RPC sliding window (the store is already
// there). It is applied where the audit flagged unbounded minting: /api/provision,
// /api/oauth/authorize, and /api/mcp.

export function createRateLimiter({ capacity = 30, refillPerSec = 0.5, clock = Date.now } = {}) {
  const buckets = new Map();
  return {
    // returns { allowed, retryAfter } — retryAfter in seconds when blocked
    take(key, cost = 1) {
      const now = clock();
      let b = buckets.get(key);
      if (!b) { b = { tokens: capacity, last: now }; buckets.set(key, b); }
      // refill
      const elapsed = (now - b.last) / 1000;
      b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
      b.last = now;
      if (b.tokens >= cost) {
        b.tokens -= cost;
        return { allowed: true, retryAfter: 0 };
      }
      const deficit = cost - b.tokens;
      return { allowed: false, retryAfter: Math.ceil(deficit / refillPerSec) };
    },
    _size() { return buckets.size; },
  };
}

// Best-effort client key from a Node/Vercel request.
export function clientKey(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}
