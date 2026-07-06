// Authorization endpoint. No login screen — connecting IS the approval, and each
// connection gets its own fresh, isolated workspace (zero-signup). We mint the
// access token here and hand back a PKCE-bound, signed, short-lived code.
import { signCode, newToken } from "../../src/oauth.mjs";

export default function handler(req, res) {
  const q = req.query || {};
  const responseType = q.response_type;
  const redirectUri = q.redirect_uri;
  const codeChallenge = q.code_challenge;
  const method = q.code_challenge_method || "plain";
  const state = q.state;

  if (responseType !== "code" || !redirectUri || !codeChallenge) {
    res.status(400).json({ error: "invalid_request" }); return;
  }
  if (method !== "S256") {
    res.status(400).json({ error: "invalid_request", error_description: "code_challenge_method must be S256" }); return;
  }
  let target;
  try { target = new URL(redirectUri); } catch { res.status(400).json({ error: "invalid_request", error_description: "bad redirect_uri" }); return; }
  if (target.protocol !== "https:") { res.status(400).json({ error: "invalid_request", error_description: "redirect_uri must be https" }); return; }

  const accessToken = newToken();
  const code = signCode(
    { at: accessToken, cc: codeChallenge, exp: Math.floor(Date.now() / 1000) + 300 },
    process.env.DIALS_OAUTH_SECRET
  );

  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  res.writeHead(302, { Location: target.toString() });
  res.end();
}
