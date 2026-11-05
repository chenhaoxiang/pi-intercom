import assert from "node:assert/strict";
import test from "node:test";
import { FOLLOWUP_SCHEDULE_EVENT, followupStatusText, requestFollowup, type FollowupBinding, type FollowupOptions, type FollowupScheduleRequest } from "./followup-api.ts";

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
  assert.match(result.reason ?? "", /did not claim create/);
});

test("status reminder names transport evidence without claiming completion", () => {
  const text = followupStatusText({ binding, record: { ...options, ...binding, version: 1, state: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  assert.match(text, /messageId: message-1/);
  assert.match(text, /ACK\/PENDING closes this reply-wait only/);
  assert.match(text, /Do not repeat the original business action/);
});

for (const action of ["create", "cancel", "get"] as const) test(`requestFollowup contains ${action} component throws without claiming a stopped timer`, async () => {
  const result = await requestFollowup({ events: { emit() { throw new Error("synthetic component fault"); } } }, action, binding, action === "create" ? options : undefined);
  assert.deepEqual({ ok: result.ok, state: result.state, completion: result.completion }, { ok: false, state: "unknown", completion: "unknown" });
  assert.match(result.reason!, /synthetic component fault.*do not resend/);
});

for (const action of ["cancel", "get"] as const) test(`unloaded ${action} support does not claim the old timer is absent`, async () => {
  const result = await requestFollowup({ events: { emit() {} } }, action, binding);
  assert.equal(result.state, "unknown");
  assert.match(result.reason!, /timer state is unchecked/);
  assert.doesNotMatch(result.reason!, /no timer was created|stopped|absent/);
});

test("requestFollowup timeout remains unknown and a late response cannot replay or change it", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let request!: FollowupScheduleRequest;
  let emits = 0;
  const pending = requestFollowup({ events: { emit(_name, payload) { emits++; request = payload; request.claim(); } } }, "cancel", binding);
  t.mock.timers.tick(10_000);
  const result = await pending;
  assert.equal(result.state, "unknown");
  assert.match(result.reason!, /timed out; do not resend/);
  request.respond({ ok: true, state: "cancelled" });
  assert.equal(await pending, result);
  assert.equal(emits, 1);
});
