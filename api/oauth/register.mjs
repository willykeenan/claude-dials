// Dynamic Client Registration (RFC 7591). We auto-approve public clients, so
// registration just mints a client_id and echoes the requested redirect_uris.
import { randomBytes } from "node:crypto";
import { readRaw, parseForm } from "../../src/oauth.mjs";

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "invalid_request" }); return; }

  let body = req.body;
  if (!body || typeof body === "string") {
    const raw = typeof body === "string" ? body : await readRaw(req);
    body = parseForm(raw, req.headers["content-type"] || "");
  }

  res.status(201).json({
    client_id: "dc_" + randomBytes(12).toString("hex"),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: Array.isArray(body?.redirect_uris) ? body.redirect_uris : [],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  });
}
