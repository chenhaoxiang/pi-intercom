import assert from "node:assert/strict";
import test from "node:test";
import { FOLLOWUP_SCHEDULE_EVENT, followupStatusText, requestFollowup, type FollowupBinding, type FollowupOptions } from "./followup-api.ts";

const binding: FollowupBinding = {
  ownerSessionId: "owner-session",
  intercomSessionId: "intercom-session",
  peerSessionId: "peer-session",
  messageId: "message-1",
};
const options: FollowupOptions = {
  requestId: "request-1",
  goal: "accepted artifact readiness",
  phase: "artifact-ready",
  deadlineAt: new Date(Date.now() + 120_000).toISOString(),
  intervalMs: 5_000,
  maxRuns: 1,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
};

test("requestFollowup binds the exact message and reads the scheduler result", async () => {
  const events = {
    emit(name: string, request: { claim: () => void; respond: (result: Record<string, unknown>) => void }) {
      assert.equal(name, FOLLOWUP_SCHEDULE_EVENT);
      request.claim();
      request.respond({ ok: true, created: true, jobId: "job-1", state: "pending", completion: "unknown" });
    },
  };
  const result = await requestFollowup({ events }, "create", binding, options);
  assert.deepEqual(result, { ok: true, created: true, jobId: "job-1", state: "pending", completion: "unknown" });
});

test("missing schedule support stays bounded and unknown", async () => {
  const result = await requestFollowup({ events: { emit() {} } }, "create", binding, options);
  assert.equal(result.ok, false);
  assert.equal(result.state, "unknown");
  assert.match(result.reason ?? "", /not loaded/);
});

test("status reminder names transport evidence without claiming completion", () => {
  const text = followupStatusText({ binding, record: { ...options, ...binding, version: 1, state: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  assert.match(text, /messageId: message-1/);
  assert.match(text, /ACK\/PENDING closes this reply-wait only/);
  assert.match(text, /Do not repeat the original business action/);
});
