// Token endpoint. Verifies the signed code + PKCE, then returns the access token
// (which is the workspace token /api/mcp already validates). No refresh tokens —
// tokens are long-lived workspace keys.
import { verifyCode, pkceOk, readRaw, parseForm } from "../../src/oauth.mjs";

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "invalid_request" }); return; }

  let body = req.body;
  if (!body || typeof body === "string") {
    const raw = typeof body === "string" ? body : await readRaw(req);
    body = parseForm(raw, req.headers["content-type"] || "");
  }

  const { grant_type, code, code_verifier } = body || {};
  if (grant_type !== "authorization_code" || !code || !code_verifier) {
    res.status(400).json({ error: "invalid_request" }); return;
  }

  const payload = verifyCode(code, process.env.DIALS_OAUTH_SECRET);
  if (!payload) { res.status(400).json({ error: "invalid_grant", error_description: "expired or invalid code" }); return; }
  if (!pkceOk(code_verifier, payload.cc)) { res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" }); return; }

  res.status(200).json({ access_token: payload.at, token_type: "Bearer", scope: "dials" });
}
