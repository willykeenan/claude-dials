// Zero-signup token provisioner. POST /api/provision -> { token, endpoint }.
// The token is a random secret the caller keeps; we never store it (only its
// hash is written, lazily, on the first dial write). No email, no payment.

import { randomBytes } from "node:crypto";
import { createRateLimiter, clientKey } from "../src/ratelimit.mjs";

// Per-instance limiter: ~10 provisions burst, refill 1 / 6s. Caps the anonymous
// token minting the audit flagged as unbounded. (Distributed enforcement would
// be a Supabase RPC sliding window; this is the zero-dep per-instance floor.)
const limiter = createRateLimiter({ capacity: 10, refillPerSec: 1 / 6 });

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  const rl = limiter.take(clientKey(req));
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res.status(429).json({ error: "rate_limited", retry_after: rl.retryAfter });
    return;
  }

  const token = "dk_" + randomBytes(24).toString("hex");
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["host"];
  const endpoint = `${proto}://${host}/api/mcp`;

  res.status(200).json({
    token,
    endpoint,
    note: "Add a claude.ai custom connector with this endpoint URL and this token as the bearer/auth. Keep the token — it's the only key to your dials, shown once.",
  });
}
