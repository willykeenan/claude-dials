# Working agreement

This project uses **Dials** (an MCP server) to define how I should work.

**At the start of every task, call the `get_dials` tool and follow the returned
settings.** Each dial's band is a concrete instruction — honor the exact value
rather than defaulting to "more." If the user asks to change how you work
("be more thorough", "just ship it", "double-check everything"), translate that
into `set_dial` / `apply_preset` calls so the preference persists.

Presets: `default`, `fable` (max rigor), `ship` (fast), `careful` (high-stakes),
`explore` (research).
