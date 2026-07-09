// Local file store. State lives at ~/.claude-dials/state.json (override with
// DIALS_STATE_FILE). Corrupt/missing state falls back to defaults rather than
// crashing — a config tool must never take down the client.
// Writes are atomic (tmp + rename) so a crash mid-write cannot leave half JSON.

import { homedir } from "node:os";
import { join, dirname, basename } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { emptyState, sanitizeValues } from "./logic.mjs";

const STATE_FILE = process.env.DIALS_STATE_FILE || join(homedir(), ".claude-dials", "state.json");

export function createFileStore(path = STATE_FILE) {
  return {
    async load() {
      try {
        if (!existsSync(path)) return emptyState();
        const raw = JSON.parse(readFileSync(path, "utf8"));
        return {
          values: sanitizeValues(raw?.values),
          activePreset: typeof raw?.activePreset === "string" ? raw.activePreset : "custom",
          updatedAt: raw?.updatedAt ?? null,
        };
      } catch {
        return emptyState();
      }
    },
    // Atomic write: write tmp in the same dir, then rename over the target.
    async save(state, stamp) {
      const out = { ...state, updatedAt: stamp ?? state.updatedAt ?? null };
      try {
        const dir = dirname(path);
        mkdirSync(dir, { recursive: true });
        const tmp = join(dir, `.${basename(path)}.${process.pid}.tmp`);
        writeFileSync(tmp, JSON.stringify(out, null, 2));
        renameSync(tmp, path);
      } catch {
        throw new Error("could not persist dial state (filesystem not writable)");
      }
      return out;
    },
  };
}
