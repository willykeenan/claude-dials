// Zero-dependency MCP core. Transport-agnostic: hand it a parsed JSON-RPC 2.0
// message + a context, get back a response object (or null for notifications).
// Implements: initialize, tools/*, resources/*, prompts/*, ping.

import { DIALS, PRESETS, PRESET_NAMES } from "./dials.mjs";
import {
  loadState, setDial, applyPreset, resetDials, renderCurrent, explainDial,
} from "./store.mjs";

export const SERVER_INFO = { name: "claude-dials", version: "0.1.0" };
const SUPPORTED = ["2024-11-05", "2025-03-26", "2025-06-18"];
const DEFAULT_PROTOCOL = "2024-11-05";

// ---- tools -------------------------------------------------------------
const TOOLS = [
  {
    name: "get_dials",
    description:
      "Read the user's current behavior dials and follow them. Call this at the start of a task to know how the user wants you to work (rigor, verification, verbosity, autonomy, etc.).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => ({ text: renderCurrent() }),
  },
  {
    name: "set_dial",
    description: "Set one behavior dial to a value 0–10. Persists across sessions.",
    inputSchema: {
      type: "object",
      properties: {
        dial: { type: "string", description: "Dial name, e.g. rigor, verification, verbosity, autonomy." },
        value: { type: "number", minimum: 0, maximum: 10, description: "0–10." },
      },
      required: ["dial", "value"],
      additionalProperties: false,
    },
    handler: (args, ctx) => {
      const r = setDial(args?.dial, args?.value, ctx.stamp);
      if (!r.ok) return { text: r.error, isError: true };
      return { text: `Set ${args.dial} → ${args.value}.\n\n${renderCurrent(r.state)}` };
    },
  },
  {
    name: "apply_preset",
    description: `Apply a named preset. One of: ${PRESET_NAMES.join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: { preset: { type: "string", enum: PRESET_NAMES } },
      required: ["preset"],
      additionalProperties: false,
    },
    handler: (args, ctx) => {
      const r = applyPreset(args?.preset, ctx.stamp);
      if (!r.ok) return { text: r.error, isError: true };
      return { text: `Applied preset "${args.preset}".\n\n${renderCurrent(r.state)}` };
    },
  },
  {
    name: "list_presets",
    description: "List the available presets and what each one does.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => {
      const rows = PRESET_NAMES.map((n) => `- **${n}** — ${PRESETS[n].description}`).join("\n");
      return { text: `Presets:\n${rows}` };
    },
  },
  {
    name: "explain_dial",
    description: "Explain what a dial means and how each value band changes behavior.",
    inputSchema: {
      type: "object",
      properties: { dial: { type: "string" } },
      required: ["dial"],
      additionalProperties: false,
    },
    handler: (args) => {
      const r = explainDial(args?.dial);
      return r.ok ? { text: r.text } : { text: r.error, isError: true };
    },
  },
  {
    name: "reset_dials",
    description: "Reset all dials to the balanced default preset.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (_args, ctx) => {
      const r = resetDials(ctx.stamp);
      return { text: `Reset to defaults.\n\n${renderCurrent(r.state)}` };
    },
  },
];
const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

// ---- resources ---------------------------------------------------------
const RESOURCES = [
  {
    uri: "dials://current",
    name: "Current dials",
    description: "The user's active behavior settings — read and follow these.",
    mimeType: "text/markdown",
    read: () => ({ mimeType: "text/markdown", text: renderCurrent() }),
  },
  {
    uri: "dials://schema",
    name: "Dials schema",
    description: "All dials, their bands, and presets as JSON.",
    mimeType: "application/json",
    read: () => ({ mimeType: "application/json", text: JSON.stringify({ dials: DIALS, presets: PRESETS }, null, 2) }),
  },
];
const RESOURCE_MAP = Object.fromEntries(RESOURCES.map((r) => [r.uri, r]));

// ---- prompts -----------------------------------------------------------
const PROMPTS = [
  {
    name: "load-dials",
    description: "Load the user's current behavior dials and follow them for this session.",
    get: () => ({
      description: "Follow the user's current behavior dials.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Adopt the following behavior settings for our session. Each dial's band is a concrete instruction; honor the exact value rather than defaulting to 'more'.\n\n" +
              renderCurrent(),
          },
        },
      ],
    }),
  },
];
const PROMPT_MAP = Object.fromEntries(PROMPTS.map((p) => [p.name, p]));

// ---- helpers -----------------------------------------------------------
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

// ---- dispatch ----------------------------------------------------------
export function handleMessage(msg, ctx = {}) {
  const stamp = ctx.stamp ?? null;
  // A notification is a request with no `id`. Per JSON-RPC 2.0 the server MUST
  // NOT reply to one — so we compute the response, then swallow it if this was
  // a notification. Side effects still run.
  const isNotification = !!msg && typeof msg === "object" && !Array.isArray(msg) && msg.id === undefined;
  const id = msg && msg.id !== undefined ? msg.id : null;
  const method = msg && msg.method;
  // MCP uses by-name params only; coerce anything non-object to {}.
  const params =
    msg && typeof msg.params === "object" && msg.params !== null && !Array.isArray(msg.params) ? msg.params : {};

  const response = dispatch(id, method, params, stamp);
  return isNotification ? null : response;
}

function dispatch(id, method, params, stamp) {
  if (!method) return err(id, -32600, "Invalid Request: missing method");

  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion;
      const protocolVersion = SUPPORTED.includes(requested) ? requested : DEFAULT_PROTOCOL;
      return ok(id, {
        protocolVersion,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: SERVER_INFO,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/roots/list_changed":
      return null;

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });

    case "tools/call": {
      const tool = TOOL_MAP[params.name];
      if (!tool) return err(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const { text, isError } = tool.handler(params.arguments || {}, { stamp });
        return ok(id, { content: [{ type: "text", text }], isError: Boolean(isError) });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Tool error: ${e.message}` }], isError: true });
      }
    }

    case "resources/list":
      return ok(id, { resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })) });

    case "resources/templates/list":
      return ok(id, { resourceTemplates: [] });

    case "resources/read": {
      const res = RESOURCE_MAP[params.uri];
      if (!res) return err(id, -32602, `Unknown resource: ${params.uri}`);
      const { mimeType, text } = res.read();
      return ok(id, { contents: [{ uri: params.uri, mimeType, text }] });
    }

    case "prompts/list":
      return ok(id, { prompts: PROMPTS.map(({ name, description }) => ({ name, description })) });

    case "prompts/get": {
      const prompt = PROMPT_MAP[params.name];
      if (!prompt) return err(id, -32602, `Unknown prompt: ${params.name}`);
      return ok(id, prompt.get());
    }

    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export { TOOLS, RESOURCES, PROMPTS };
