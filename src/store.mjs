// Local file store. State lives at ~/.claude-dials/state.json (override with
// DIALS_STATE_FILE). Corrupt/missing state falls back to defaults rather than
// crashing — a config tool must never take down the client.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { emptyState, sanitizeValues } from "./logic.mjs";

const STATE_FILE = process.env.DIALS_STATE_FILE || join(homedir(), ".claude-dials", "state.json");

export function createFileStore() {
  return {
    async load() {
      try {
        if (!existsSync(STATE_FILE)) return emptyState();
        const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
        return {
          values: sanitizeValues(raw?.values),
          activePreset: typeof raw?.activePreset === "string" ? raw.activePreset : "custom",
          updatedAt: raw?.updatedAt ?? null,
        };
      } catch {
        return emptyState();
      }
    },
    // Wraps I/O so a filesystem error surfaces cleanly, never leaking the path.
    async save(state, stamp) {
      const out = { ...state, updatedAt: stamp ?? state.updatedAt ?? null };
      try {
        mkdirSync(join(STATE_FILE, ".."), { recursive: true });
        writeFileSync(STATE_FILE, JSON.stringify(out, null, 2));
      } catch {
        throw new Error("could not persist dial state (filesystem not writable)");
      }
      return out;
    },
  };
}
