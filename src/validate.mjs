// Minimal JSON-Schema-subset validator (zero deps). Enforces exactly the schema
// features the tool inputSchemas actually declare — type, required,
// additionalProperties:false, enum, minimum/maximum — so `tools/call` rejects
// malformed arguments at the PROTOCOL layer with -32602 instead of relying on
// downstream hand-validation. Returns { ok } or { ok:false, error }.

function typeOk(value, type) {
  switch (type) {
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return true; // unknown type constraint -> don't block
  }
}

// opts.structuralOnly: enforce only shape (type, required, additionalProperties)
// and skip value constraints (enum/minimum/maximum). tools/call uses this so
// DOMAIN errors (out-of-range dial, unknown preset) still surface as friendly
// isError tool-results the model can read and self-correct, rather than a bare
// -32602. Full mode (default) is used by unit tests to exercise every rule.
export function validateAgainstSchema(schema, value, opts = {}) {
  if (!schema || typeof schema !== "object") return { ok: true };
  const structuralOnly = !!opts.structuralOnly;

  if (schema.type && !typeOk(value, schema.type)) {
    return { ok: false, error: `expected ${schema.type}, got ${Array.isArray(value) ? "array" : typeof value}` };
  }

  if (schema.type === "object" || schema.properties) {
    const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const props = schema.properties || {};

    for (const key of schema.required || []) {
      if (!(key in obj) || obj[key] === undefined) {
        return { ok: false, error: `missing required property "${key}"` };
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) return { ok: false, error: `unexpected property "${key}"` };
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj && obj[key] !== undefined) {
        const r = validateAgainstSchema(sub, obj[key], opts);
        if (!r.ok) return { ok: false, error: `"${key}": ${r.error}` };
      }
    }
  }

  if (!structuralOnly) {
    if (schema.enum && !schema.enum.includes(value)) {
      return { ok: false, error: `must be one of ${JSON.stringify(schema.enum)}` };
    }
    if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
      return { ok: false, error: `must be >= ${schema.minimum}` };
    }
    if (typeof schema.maximum === "number" && typeof value === "number" && value > schema.maximum) {
      return { ok: false, error: `must be <= ${schema.maximum}` };
    }
  }
  return { ok: true };
}
