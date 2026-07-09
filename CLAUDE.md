# Working agreement

This project uses **Dials** (an MCP server) to define how I should work.

**At the start of every task, call the `get_dials` tool and treat the result as binding constraints — not suggestions.** Each dial's band is a concrete MUST. Honor the exact value; higher is not always better. If two dials conflict (e.g. high rigor + low verbosity), obey both.

If the user asks to change how you work ("be more thorough", "just ship it", "double-check everything"), translate that into `set_dial` / `apply_preset` so the preference persists across sessions.

Presets: `default`, `fable` (max rigor), `ship` (fast), `careful` (high-stakes), `explore` (research).
