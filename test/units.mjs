#!/usr/bin/env node
// Fast, hermetic unit tests for the hardening modules (schema validator +
// rate limiter). Complements verify.mjs (the end-to-end protocol suite).

import { validateAgainstSchema } from "../src/validate.mjs";
import { createRateLimiter } from "../src/ratelimit.mjs";
import { requireSecret, verifyCode, signCode } from "../src/oauth.mjs";
import { effect, JUDGES } from "../eval/judge.mjs";

let pass = 0, fail = 0;
const check = (name, cond) => cond
  ? (pass++, console.log(`  \x1b[32m✓\x1b[0m ${name}`))
  : (fail++, console.log(`  \x1b[31m✗ ${name}\x1b[0m`));

console.log("claude-dials — unit tests\n");

// ---- validator ----
const setDialSchema = {
  type: "object",
  properties: { dial: { type: "string" }, value: { type: "number", minimum: 0, maximum: 10 } },
  required: ["dial", "value"], additionalProperties: false,
};
check("accepts a valid object", validateAgainstSchema(setDialSchema, { dial: "rigor", value: 5 }).ok);
check("rejects missing required", !validateAgainstSchema(setDialSchema, { dial: "rigor" }).ok);
check("rejects unknown property", !validateAgainstSchema(setDialSchema, { dial: "r", value: 5, x: 1 }).ok);
check("rejects wrong type", !validateAgainstSchema(setDialSchema, { dial: "r", value: "5" }).ok);
check("structuralOnly skips range", validateAgainstSchema(setDialSchema, { dial: "r", value: 99 }, { structuralOnly: true }).ok);
check("full mode enforces maximum", !validateAgainstSchema(setDialSchema, { dial: "r", value: 99 }).ok);
check("enum enforced", !validateAgainstSchema({ type: "string", enum: ["a", "b"] }, "c").ok);
check("empty schema is permissive", validateAgainstSchema({}, { anything: true }).ok);

// ---- rate limiter ----
let now = 0;
const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, clock: () => now });
check("allows up to capacity", rl.take("k").allowed && rl.take("k").allowed && rl.take("k").allowed);
const blocked = rl.take("k");
check("blocks past capacity with retryAfter", !blocked.allowed && blocked.retryAfter >= 1);
check("separate keys have separate buckets", rl.take("other").allowed);
now = 2000; // 2s later -> +2 tokens
check("refills over time", rl.take("k").allowed);

// ---- oauth fail-closed ----
let threw = false;
try { requireSecret(""); } catch { threw = true; }
check("requireSecret rejects empty secret", threw);
check("verifyCode fails closed on weak secret", verifyCode("anything.sig", "short") === null);
const secret = "a-sufficiently-long-signing-secret";
const code = signCode({ at: "dk_x", cc: "c", exp: Math.floor(Date.now() / 1000) + 300 }, secret);
check("sign+verify round-trips with a good secret", verifyCode(code, secret)?.at === "dk_x");
check("verify rejects a tampered code", verifyCode(code.replace(/.$/, "0"), secret) === null);

// ---- obedience judges (prove the eval is not rigged to always pass) ----
check("verbosity judge tracks length", JUDGES.verbosity("a b c d e") > JUDGES.verbosity("a b"));
check("verification judge tracks evidence", JUDGES.verification("I ran the test and assert it works ```code```") > JUDGES.verification("it works"));
const nullEffect = effect("verbosity", "same text here", "same text here");
check("identical low/high responses -> zero effect (would FAIL the gate)", nullEffect.normalized === 0);
const realEffect = effect("rigor", "looks fine", "consider the edge case; however the boundary and failure mode differ, alternatively...");
check("thorough response out-scores terse on rigor", realEffect.normalized > 0.15);

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m`);
process.exit(fail === 0 ? 0 : 1);
