import assert from "node:assert/strict";
import test from "node:test";
import { snapshotMessageRelations } from "./extension-api.ts";

const base = { version: 1, senderSessionId: "sender-route", recipientSessionId: "recipient-route", replyCorrelation: "none" };
test("relationship snapshots preserve only bounded broker metadata", () => {
  assert.deepEqual(snapshotMessageRelations(base), base);
  const replaced = { ...base, supersedes: "prior-question" };
  assert.deepEqual(snapshotMessageRelations(replaced), replaced);
  const late = { ...base, lateReplyTo: "prior-question", replyCorrelation: "late" };
  assert.deepEqual(snapshotMessageRelations(late), late);
  assert.notEqual(snapshotMessageRelations(late), late);
  const uncertain = { ...late, replyCorrelation: "unknown" };
  assert.deepEqual(snapshotMessageRelations(uncertain), uncertain);
});
for (const value of [undefined, null, { ...base, version: 2 }, { ...base, senderSessionId: "/private/path" },
  { ...base, recipientSessionId: "x".repeat(129) }, { ...base, supersededBy: ".." },
  { ...base, replyCorrelation: "matched" }, { ...base, replyCorrelation: "late" },
  { ...base, replyTo: "old", lateReplyTo: "other", replyCorrelation: "unknown" },
  { ...base, replyTo: "old" }, { ...base, content: "Must not be exported" },
]) test(`relationship snapshot rejects unknown/contradictory input ${JSON.stringify(value)}`, () => {
  assert.equal(snapshotMessageRelations(value), undefined);
});
test("relationship projection does not invoke accessors or proxy traps", () => {
  let calls = 0;
  const value = { ...base, get replyTo() { calls++; throw Error("private getter"); } };
  assert.equal(snapshotMessageRelations(value), undefined);
  assert.equal(snapshotMessageRelations(new Proxy(base, { getPrototypeOf() { calls++; throw Error("proxy trap"); } })), undefined);
  assert.equal(calls, 0);
});
