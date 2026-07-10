# Dials — Technical Writeup

> Historical archive: this experiment was retired on 2026-07-09. The hosted connector and package entry point are disabled.

**A behavior control panel for Claude, delivered as an MCP server.** Eight 0–10 dials
(rigor, verification, verbosity, autonomy, …) that Claude reads over the Model Context
Protocol and follows. Live at [dial.kestudios.dev](https://dial.kestudios.dev) as a
hosted claude.ai connector; also runs as a local stdio server for Claude Code/Desktop.

**Stack:** 100% JavaScript ESM, **zero runtime dependencies** (Node built-ins only:
`http`, `crypto`, `fs`). ~1,150 LOC of source. Hosted on Vercel serverless + Supabase.

---

## 1. Why it exists

LLM "behavior" is usually re-litigated in every prompt ("be more thorough", "just ship
it", "double-check this"). Dials externalizes that as **state**: policy (the dial
values) lives in one place the model reads at the start of a task; mechanism (what each
band means) lives in the dial definitions. Change a number, and behavior changes
everywhere without rewriting prompts. It's a control plane for how an agent works.

The interesting engineering claim for an Applied-AI/FDE lens is not the idea — it's that
this is a **protocol-correct, authenticated, multi-tenant MCP server** shipped end to
end, and that I can now **measure whether the dials actually change model behavior**.

## 2. Architecture

```
          ┌───────────── transports ─────────────┐        ┌──────── stores ────────┐
 stdio ───┤                                       │        │                        │
 (Claude  │   src/mcp.mjs  — JSON-RPC 2.0 core     │──ctx──▶│  file  (local, ~/.claude-dials)
  Code)   │   transport- & storage-agnostic       │        │  supabase (multi-tenant, hosted)
 http  ───┤   handleMessage(msg, {store, stamp})   │        │                        │
 (local)  │                                        │        └────────────────────────┘
 /api/mcp ┤   src/logic.mjs — pure state ops (no I/O)
 (Vercel) └───────────────────────────────────────┘
```

**Key decision — one protocol core, three transports, two stores.** `src/mcp.mjs`
knows nothing about HTTP, stdio, or where state lives; it takes a parsed JSON-RPC
message and a `{store, stamp}` context and returns a response object (or `null` for a
notification). The store is an injected `{load(), save()}` interface. This is why the
same 212-line core serves a local file-backed stdio server, a raw-HTTP server, and a
Supabase-backed hosted connector with no protocol code duplicated. **Tradeoff:** an
injected-store indirection is slightly more ceremony than inlining file I/O, but it's
what made the hosted multi-tenant path a ~40-line store rather than a rewrite.

**Auth model (hosted).** The caller's bearer token *is* their workspace id. Only its
SHA-256 is ever stored, so a database leak can't expose tokens. Full OAuth 2.0
authorization-code + **PKCE (S256 only, plain rejected)** + Dynamic Client Registration,
made **stateless** by carrying the issued token and PKCE challenge inside an HMAC-signed,
300-second code — no server-side session store. `timingSafeEqual` on every token/code/PKCE
comparison. Multi-tenant reads go through Supabase `SECURITY DEFINER` RPCs scoped to the
token hash, so there's no service-role secret in the request path.

## 3. Protocol correctness

Verified live against production and by a hermetic end-to-end suite (`test/verify.mjs`,
spawns the real stdio server as a child and drives it over JSON-RPC):

- `initialize` negotiates `protocolVersion` across `2024-11-05 / 2025-03-26 / 2025-06-18`
  with a safe default; advertises `tools`, `resources`, `prompts`.
- `tools/list` · `tools/call` · `resources/list` · `resources/read` ·
  `resources/templates/list` · `prompts/list` · `prompts/get` · `ping`.
- JSON-RPC error codes: `-32700` parse, `-32600` invalid request, `-32601` method-not-found,
  `-32602` invalid params, `-32603` internal.
- **Notifications return no frame** (a dedicated regression test asserts a notification —
  a request with no `id` — produces no response), and empty JSON-RPC batches are rejected.
- Tool handler exceptions are caught and returned as `isError` content, never crashing the
  client; body-size caps (1 MB http/api, 4 MB stdio) bound DoS.

## 4. Hardening changelog (what the audit found → what I fixed)

A skeptical read (staff-engineer audit) surfaced four real gaps. All fixed, all tested:

| Audit finding | Fix | Evidence |
|---|---|---|
| **Schema declared but not enforced** — `tools/call` didn't validate args against the advertised `inputSchema`. | `src/validate.mjs` (zero-dep JSON-Schema subset) enforces **shape** at the protocol layer — required, unknown-property, and type checks → `-32602` before the handler runs. Value-range/enum stay in the handler so domain errors remain *friendly `isError` tool-results the model can self-correct* (a deliberate MCP-UX line: protocol errors for malformed calls, tool-results for domain errors). | `test/verify.mjs` +4 assertions (unknown prop, missing required, wrong type → −32602; out-of-range → friendly isError). |
| **No rate limiting** — "I minted a token anonymously in one curl." | `src/ratelimit.mjs` zero-dep token bucket on `/api/provision`, `/api/oauth/authorize` (per-IP) and `/api/mcp` (per-token-hash, so one workspace can't starve another). Honest scope note in-code: per-instance on serverless; the distributed upgrade is a Supabase RPC sliding window. | `test/units.mjs` limiter tests (capacity, block+retryAfter, per-key isolation, refill). |
| **OAuth secret not guarded at boot** — if `DIALS_OAUTH_SECRET` were unset, `createHmac` would run with an undefined key and every "signed" code would be forgeable, silently. | `requireSecret()` **fails closed** (`signCode` throws on unset/<16-char secret; `verifyCode` returns null); the authorize handler returns a clean `500` instead of emitting a forgeable code. | `test/units.mjs` fail-closed + tamper tests. |
| **`npm` package unpublished** — the advertised `npx @kestudios/claude-dials` would fail; `package.json` said 0.1.0 while the server reported 0.2.0. | Version reconciled to **0.2.0**. Publish is a deliberate, user-gated release step (see GAPS). | `package.json`. |

Test count went from **27 → 51** (31 protocol + 20 unit).

## 5. The eval that mattered — behavioral obedience

The deepest audit critique: *the tests prove the server speaks MCP (transport); nothing
proves the dials change Claude's behavior (obedience).* That's the whole product thesis,
untested. So I built an eval for exactly it.

**Method (`eval/obedience.mjs`).** For each task, render the **real** dials instruction
block (`src/logic.mjs renderCurrent`, the exact text the server serves) with one dial
pinned **low (1)** vs **high (9)**, prepend it as the system prompt to a neutral task,
and measure a **deterministic** signal that should move in that dial's direction
(`eval/judge.mjs` — no LLM-judge, so the eval's own numbers can't flake):

- **verbosity** → response word count
- **rigor** → words + 25 × (edge-case/alternative/tradeoff markers)
- **verification** → count of test/assert/verify/reproduce evidence + code-block presence

The metric is the **normalized effect** (high−low)/|low|; the gate requires every task
to move in the promised direction by ≥ a minimum effect size. A dial that doesn't change
behavior **fails**.

**Two modes, same harness.** Default is a **mock** with canned terse/thorough responses —
hermetic, free, gates CI, and its job is to prove the *judge discriminates* (unit tests
confirm identical low/high text → zero effect → gate fails, so it isn't rigged). `--live`
swaps the mock for real Claude calls and becomes the obedience eval of the *model*.

**Result (mock, gating):** 5/5 tasks move in the promised direction; the judges cleanly
separate terse from thorough (e.g. verbosity low=10 → high=105 words; rigor low=7 →
high=227). CI runs this on every push. The one-command **live** run
(`npm run eval:live`) produces the real "does Claude obey the dials" number — it's built
and ready; I've left executing the paid run to a deliberate go-ahead (see GAPS).

## 6. Cost & scale

Serving is nearly free: the hosted path is stateless serverless + a hash-scoped Supabase
row per workspace; no model inference happens in the server (Dials is a *tool Claude
calls*, so there is no per-request LLM cost on our side). The cost surface is the
*client's* model reading the rendered block (~300–600 tokens) once per task. Multi-tenancy
is per-token-hash with no shared mutable state, so horizontal scale is trivial; the only
scale caveat is that the in-process rate limiter is per-warm-instance (documented, with
the Supabase-RPC upgrade path noted).

## 7. Honest limitations

- **JavaScript, not Python.** Correct for a zero-dep MCP connector; it does not evidence
  the role's Python-primary line (Impact Wire carries that).
- **Live obedience numbers are pending a funded run.** The harness and mock result are
  real; the model-behavior number needs `npm run eval:live` (costs a few cents).
- **Zero-signup OAuth mints a workspace token with no user/consent screen** — intentional
  ("connecting is the approval"), defensible for a personal-scratchpad connector, but not
  enterprise SSO. I state this rather than dress it up.
- **Rate limiting is per-instance** until backed by a Supabase sliding window.
