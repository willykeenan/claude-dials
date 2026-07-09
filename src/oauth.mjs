// Minimal OAuth 2.0 (authorization-code + PKCE + dynamic client registration)
// for the MCP authorization spec that claude.ai follows. Stateless: the auth code
// is an HMAC-signed, short-lived blob carrying the issued access token + the PKCE
// challenge, so no server-side session store is needed. The access token IS the
// workspace token (dk_…) the /api/mcp endpoint already understands.

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function baseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${req.headers.host}`;
}

export function newToken() {
  // Same shape as /api/provision so hosted MCP can validate format uniformly.
  return "dk_" + randomBytes(24).toString("hex");
}

// Fail closed: the signing secret is load-bearing for the whole auth-code flow.
// If it is unset/short, an unguarded createHmac would run with an undefined key
// and every "signed" code would be forgeable — so refuse rather than degrade.
export function requireSecret(secret) {
  if (typeof secret !== "string" || secret.length < 16) {
    throw new Error("DIALS_OAUTH_SECRET is unset or too short (need >=16 chars) — refusing to sign with a weak key");
  }
  return secret;
}

export function signCode(payload, secret) {
  requireSecret(secret);
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCode(code, secret) {
  if (typeof secret !== "string" || secret.length < 16) return null; // fail closed
  const [body, sig] = String(code || "").split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
  return p;
}

// PKCE S256: challenge must equal base64url(sha256(verifier)).
export function pkceOk(verifier, challenge) {
  const h = createHash("sha256").update(String(verifier || "")).digest("base64url");
  const a = Buffer.from(h), b = Buffer.from(String(challenge || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readRaw(req) {
  return new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); req.on("error", () => resolve(""));
  });
}

export function parseForm(raw, ct = "") {
  if (!raw) return {};
  if (ct.includes("application/json")) { try { return JSON.parse(raw); } catch { return {}; } }
  const o = {}; for (const [k, v] of new URLSearchParams(raw)) o[k] = v; return o;
}
