# Dials — a behavior control panel for Claude

**Give Claude a set of 0–10 sliders — rigor, verification, verbosity, autonomy — that it reads over MCP and actually follows.** Tune how Claude works from the outside, as data, instead of re-typing "be more thorough / just ship it / double-check everything" in every chat. The settings persist across sessions and work in Claude Code, Claude Desktop, and claude.ai.

Free. MIT. **Zero dependencies.**

**On claude.ai?** Get a free hosted connector (no signup) at **https://claude-dials.vercel.app** — generate a token, paste the endpoint + token into a custom connector, done.

**In Claude Code / Desktop?** One line:

```bash
claude mcp add dials -- npx -y github:willykeenan/claude-dials
```

---

## Why

How Claude behaves is normally buried in prose — system prompts, CLAUDE.md, whatever you remember to say. Prose can't be *dialed*. Dials turns the tunable dimensions into numbered sliders exposed as MCP tools + a resource. Slide one, and every task after it changes. That's a control plane for the model, not a notes file.

## The dials

| Dial | 0 | 10 |
|---|---|---|
| **Rigor** | quick first-pass | exhaustive reasoning |
| **Context depth** | act on the prompt alone | read the full surrounding context first |
| **Verification** | assert it's done | run it and show evidence |
| **Self-review** | ship the first draft | adversarial critique before delivering |
| **Verbosity** | one-liner | exhaustive explanation |
| **Autonomy** | ask before acting | just do it, report after |
| **Novelty** | proven patterns only | bleeding-edge |
| **Caution** | move fast | treat as if it'll be reviewed |

Each value maps to a concrete instruction (see `dials://schema`), so Claude gets an unambiguous directive, not a vibe.

## Presets

- `default` — balanced baseline
- `fable` — maximum rigor: read everything, verify with evidence, self-critique; terse replies, meticulous work
- `ship` — fast and autonomous, for low-stakes velocity
- `careful` — high-stakes: verify everything, ask before acting, max caution
- `explore` — research/prototyping: reach wide, try new things

## Tools

`get_dials` · `set_dial(dial, value)` · `apply_preset(preset)` · `list_presets` · `explain_dial(dial)` · `reset_dials`

And a resource `dials://current` (the live settings as Markdown) + `dials://schema` (full JSON), plus a `load-dials` prompt.

## Install

| Client | How |
|---|---|
| **Claude Code** | `claude mcp add dials -- npx -y github:willykeenan/claude-dials` — [details](configs/claude-code.md) |
| **Claude Desktop** | add the snippet in [`configs/claude_desktop_config.json`](configs/claude_desktop_config.json) |
| **claude.ai** | free hosted connector — generate one at [claude-dials.vercel.app](https://claude-dials.vercel.app), or self-host `src/http.mjs` ([details](configs/connector.md)) |

Drop [`CLAUDE.md`](CLAUDE.md) into a repo to make Claude read your dials at the start of every task.

## Use it

> "get my dials" · "set rigor to 9" · "apply the careful preset" · "explain the autonomy dial"

Or just talk: "double-check everything from now on" → Claude bumps `verification`.

## Design notes

- **Zero dependencies.** The MCP wire protocol (JSON-RPC 2.0 over stdio + Streamable HTTP) is implemented directly. No SDK, no supply-chain surface, instant `npx`.
- **State** lives at `~/.claude-dials/state.json` (override with `DIALS_STATE_FILE`). Corrupt or missing state falls back to defaults — a config tool must never take down the client.
- **Remote auth.** The HTTP transport takes an optional `DIALS_TOKEN` bearer token; unset = open (local dev only).

## Verify it yourself

```bash
npm test
```

Spawns the real server over stdio and drives a full JSON-RPC handshake — 25 assertions across initialize, tools, resources, prompts, persistence, and error paths.

## License

MIT — built by [KE Studios](https://kestudios.dev). https://dials.kestudios.dev
