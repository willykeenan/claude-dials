# Add Dials as a claude.ai custom connector (remote MCP)

Claude.ai connectors talk to a **remote** MCP server over Streamable HTTP. Dials
ships that transport in `src/http.mjs`.

## 1. Host it
Deploy on any Node host that keeps a process alive (Railway, Render, Fly.io, a
VPS). Set a token so it isn't world-writable:

```bash
DIALS_TOKEN="a-long-random-string" PORT=8787 node src/http.mjs
# exposes POST https://your-host/mcp  and  GET /health
```

> **State note:** the default store is a JSON file on disk, so host it somewhere
> with a persistent filesystem (or a single long-lived instance). Pure serverless
> (Vercel functions) won't persist dial changes between calls — fine for a
> read-only demo, not for `set_dial`. A DB-backed store is the drop-in upgrade.

## 2. Add the connector
In claude.ai → **Settings → Connectors → Add custom connector**:
- **URL:** `https://your-host/mcp`
- **Auth:** bearer token = your `DIALS_TOKEN` (or append `?token=...` to the URL if the UI has no header field)

## 3. Verify
```bash
curl -s https://your-host/health
curl -s -X POST https://your-host/mcp \
  -H "authorization: Bearer $DIALS_TOKEN" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Once connected, Claude can call `get_dials` / `set_dial` / `apply_preset` from any
chat on claude.ai.
