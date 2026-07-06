# Add Dials to Claude Code

## Fastest (published package)
```bash
claude mcp add dials -- npx -y github:willykeenan/claude-dials
```

## From a local clone
```bash
claude mcp add dials -- node /ABSOLUTE/PATH/claude-dials/src/stdio.mjs
```

## Or drop a `.mcp.json` in your project root
```json
{
  "mcpServers": {
    "dials": {
      "command": "npx",
      "args": ["-y", "github:willykeenan/claude-dials"]
    }
  }
}
```

Then in Claude Code: `/mcp` to confirm it's connected. Try:
- "get my dials"
- "set rigor to 9"
- "apply the careful preset"

The `load-dials` prompt is exposed too — it shows up as a slash-style prompt in clients that surface MCP prompts.
