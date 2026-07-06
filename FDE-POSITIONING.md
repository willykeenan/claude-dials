# Dials → Anthropic Forward Deployed Engineer

Strategy for using this artifact (and the KE Studios portfolio) to land an FDE role.

## Verdict
**Lead your application with Dials.** It is the single most on-target thing you've built for this specific role — not because it's your biggest project, but because it's *about the exact thing an FDE does*: shaping how Claude behaves in a real deployment, delivered over the integration layer Anthropic cares most about (MCP). It's small, verifiable, and shows taste. Everything else in the portfolio becomes supporting evidence of *velocity and range*.

## What an FDE actually does (and the evidence you now have)
An Anthropic Forward Deployed Engineer embeds with strategic customers, turns an ambiguous business problem into a working Claude solution (usually agents / tool-use / MCP), ships prototypes fast, and feeds learnings back to product. The hiring bar is: strong engineer **+** fluent in the Claude platform **+** customer-facing **+** thrives in ambiguity.

| What they screen for | What you show |
|---|---|
| MCP / tool-use fluency | Dials — MCP server implemented **from the wire protocol up, zero deps**, both stdio + Streamable HTTP transports, works in Claude Code / Desktop / claude.ai |
| Makes Claude more useful in-context | The entire premise of Dials: externalized, user-tunable behavior policy the model reads and follows |
| Ships fast, ships real | ~30 deployed products across DTC, fintech, creator, accessibility, dev-tools |
| Rigor / production judgment | 27-assertion end-to-end test suite; ran an adversarial review, fixed a real JSON-RPC spec bug + 5 security issues, re-verified |
| Ambiguity → working system | You are simultaneously the customer, the PM, and the engineer on every project — that IS the FDE loop, run solo, 30 times |

## The 30-second pitch (use this verbatim-ish)
> "I built a free MCP server called Dials that gives Claude a control panel — 0–10 sliders like rigor, verification, and autonomy that Claude reads and follows, so you tune its behavior as data instead of re-prompting. Zero dependencies, works across the whole Claude stack, fully tested. It came out of running ~30 of my own products on Claude and wanting to change how it works per-project without rewriting prompts. That gap — turning 'how should the model behave here' into something a non-engineer can dial — is basically the FDE job, so I shipped the tool for it."

## Demo script (≤ 3 min, live)
1. `claude mcp add dials -- npx -y @kestudios/claude-dials` — one line, it's connected.
2. "get my dials" → Claude reads the resource and states how it'll work.
3. "apply the careful preset" → watch the behavior table flip (autonomy down, verification up).
4. Open `dials.kestudios.dev`, drag a slider, show the instruction text change live.
5. `npm test` → 27 green checks. "I don't claim it works, I show it."
6. One line on the adversarial review: "I had agents try to break it, they found a real spec bug in notification handling, I fixed it and added a regression test." ← this is the moment that lands.

## Repositioning the broader portfolio for FDE
Don't show all 30. Curate to the through-line **"I deploy Claude into real products and ship."**

- **Lead:** Dials (platform depth) + the KE Studios Brain control-plane idea (systems thinking about agent behavior).
- **Show range with 3-4 deployed products, each a different Claude integration pattern:**
  - **OpenClaw** — multi-agent gateway (Discord/iMessage), 5 agents, real orchestration.
  - **Witness** — local daemon with its own **MCP server** + Claude narration/QA. (Second MCP artifact — reinforces the theme.)
  - **Hope Studio / Castingiron** — Claude in a revenue product (agentic generation, Stripe, live users).
  - **Bup AI** — Claude driving a Mac for a stroke-recovery user via `claude -p`; agentic + a hard "never touch money" safety backstop. **This one shows you think about safety and real-human stakes** — Anthropic weights that heavily.
- **De-emphasize** (not hide, just don't lead): the trading bots and anything that reads as "get rich" — for *this* audience it distracts from the engineer/impact narrative. Bup AI, accessibility, and the dev-tools read far better.

## Resume / application bullets (copy-paste)
- Built **Dials**, a zero-dependency MCP server that exposes Claude's working behavior as tunable 0–10 dials; implemented the MCP JSON-RPC protocol directly across stdio + Streamable HTTP; verified with a 27-assertion end-to-end suite and an adversarial multi-agent review.
- Shipped ~30 Claude-powered products end-to-end (Next.js/Vercel, Stripe, Supabase), including a multi-agent messaging gateway and an agentic accessibility tool that safely drives a stroke survivor's computer.
- Designed a "behavior-as-config" control plane for agent fleets — externalized, human-editable policy the model reads at runtime instead of hard-coded prompts.

## Honest gaps to preempt
- **Enterprise/customer-facing:** your work is indie/consumer, not enterprise deployments. Frame it as: *you've run the full ambiguity→ship loop dozens of times as your own customer; point you at a real customer and it's the same loop with a stakeholder.* Don't hide it — name it and reframe.
- **Team/collaboration signal:** solo-founder portfolios can read as "doesn't work with others." Counter with the adversarial-review workflow (you orchestrate and critique work, not just produce it) and any collab (K&E Studios, Merz on NextStep).

## Next steps
1. Deploy `site/` to `dials.kestudios.dev` (Vercel + Namecheap CNAME) and publish the npm package — a live URL + `npx` install is the credibility unlock.
2. Push to a public GitHub repo (`github.com/kestudios/claude-dials`) — the README + test suite + the fixed-bug commit history *is* your work sample.
3. Record the 90-second demo above.
4. Write the application around the pitch, link the live tool, the repo, and Bup AI.
