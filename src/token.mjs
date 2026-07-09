// Workspace tokens are minted as `dk_` + 24 random bytes hex (48 hex chars).
// Hosted auth treats the token as the workspace id — validating the format
// rejects junk like `Bearer bogus` that would otherwise silently create empty
// workspaces and pollute the store.

const RE = /^dk_[a-f0-9]{48}$/i;

export function isWorkspaceToken(token) {
  return typeof token === "string" && RE.test(token);
}

export function mintWorkspaceToken(randomBytes) {
  return "dk_" + randomBytes(24).toString("hex");
}
