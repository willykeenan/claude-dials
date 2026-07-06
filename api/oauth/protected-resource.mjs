// Protected Resource Metadata (RFC 9728) — served at
// /.well-known/oauth-protected-resource via a rewrite in vercel.json.
import { baseUrl } from "../../src/oauth.mjs";

export default function handler(req, res) {
  const b = baseUrl(req);
  res.setHeader("access-control-allow-origin", "*");
  res.status(200).json({
    resource: b,
    authorization_servers: [b],
  });
}
