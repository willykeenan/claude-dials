// Supabase-backed store for the hosted connector. Multi-tenant: every workspace
// is keyed by the sha256 of the user's bearer token. Reaches the DB only through
// two SECURITY DEFINER RPCs (dials_load / dials_save) scoped to that hash, so the
// publishable key is all the server needs — no service-role secret.

import { emptyState, sanitizeValues } from "./logic.mjs";

export function createSupabaseStore({ url, key, tokenHash }) {
  async function rpc(fn, body) {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`store backend error (${fn}: ${r.status})`);
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    async load() {
      const rows = await rpc("dials_load", { p_hash: tokenHash });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return emptyState();
      return {
        values: sanitizeValues(row.dial_values),
        activePreset: row.active_preset || "custom",
        updatedAt: row.updated_at || null,
      };
    },
    async save(state, stamp) {
      const updated = stamp ?? state.updatedAt ?? null;
      await rpc("dials_save", {
        p_hash: tokenHash,
        p_values: state.values,
        p_preset: state.activePreset,
        p_updated: updated,
      });
      return { ...state, updatedAt: updated };
    },
  };
}
