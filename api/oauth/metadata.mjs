// Authorization Server Metadata (RFC 8414) — served at
// /.well-known/oauth-authorization-server via a rewrite in vercel.json.
import { baseUrl } from "../../src/oauth.mjs";

export default function handler(req, res) {
  const b = baseUrl(req);
  res.setHeader("access-control-allow-origin", "*");
  res.status(200).json({
    issuer: b,
    authorization_endpoint: `${b}/api/oauth/authorize`,
    token_endpoint: `${b}/api/oauth/token`,
    registration_endpoint: `${b}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["dials"],
  });
}
