import test from "node:test";
import assert from "node:assert/strict";
import { formatTokenCount, formatContextUsage, messageAttention } from "./format-context.ts";
import type { SessionInfo } from "./types.ts";

test("message attention labels only existing sender intent, never task execution", () => {
  assert.equal(messageAttention({ wakeProtocol: 1 }), "context-only");
  assert.equal(messageAttention({ wake: true }), "wake-requested");
  assert.equal(messageAttention({ expectsReply: true }), "wake-requested");
  assert.equal(messageAttention({ replyTo: "exact-message" }), "wake-requested");
  assert.equal(messageAttention({ wake: false, expectsReply: true, replyTo: "exact-message" }), "context-only");
  assert.equal(messageAttention({}), "unknown", "legacy unmarked intent is not inferred");
});

const base: SessionInfo = { id: "s1", cwd: "/w", model: "m", pid: 1, startedAt: 0, lastActivity: 0 };

test("formatTokenCount compacts thousands", () => {
  assert.equal(formatTokenCount(0), "0");
  assert.equal(formatTokenCount(999), "999");
  assert.equal(formatTokenCount(1432), "1.4k");
  assert.equal(formatTokenCount(144000), "144k");
  assert.equal(formatTokenCount(200000), "200k");
});

test("formatContextUsage renders percent + token detail when all known", () => {
  assert.equal(
    formatContextUsage({ ...base, contextPct: 72, contextTokens: 144000, contextWindow: 200000 }),
    " · 72% ctx (144k/200k)",
  );
});

test("formatContextUsage shows percent only when token counts are absent", () => {
  assert.equal(formatContextUsage({ ...base, contextPct: 30 }), " · 30% ctx");
});

test("formatContextUsage renders nothing when percent is unknown (never a stale %)", () => {
  assert.equal(formatContextUsage(base), "");
  // Tokens present but no percent (e.g. right after a compaction) still renders nothing.
  assert.equal(formatContextUsage({ ...base, contextTokens: 100, contextWindow: 200 }), "");
});
