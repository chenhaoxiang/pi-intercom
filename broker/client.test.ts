import test from "node:test";
import assert from "node:assert/strict";
import { IntercomClient } from "./client.ts";

test("validated session lifecycle messages reach broker-message subscribers", () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  const received: unknown[] = [];
  client.onBrokerMessage((message) => received.push(message));
  const session = {
    id: "session-2",
    cwd: "/test",
    model: "test",
    pid: 2,
    startedAt: 1,
    lastActivity: 1,
  };

  (client as any).handleBrokerMessage({ type: "session_joined", session });
  (client as any).handleBrokerMessage({ type: "presence_update", session });
  (client as any).handleBrokerMessage({ type: "session_left", sessionId: "session-2" });

  assert.deepEqual(received, [
    { type: "session_joined", session },
    { type: "presence_update", session },
    { type: "session_left", sessionId: "session-2" },
  ]);
});

test("registered feature negotiation rejects non-string feature entries", () => {
  const client = new IntercomClient();
  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "registered", sessionId: "session-1", features: ["valid", 123] }),
    /Invalid registered features/,
  );
});

test("broker runtime report is optional and is not inferred from the client package", () => {
  for (const [reported, expected] of [[undefined, undefined], ["0.18.0-fork.2", "0.18.0-fork.2"], ["bad\nversion", undefined]]) {
    const client = new IntercomClient();
    (client as any).handleBrokerMessage({ type: "registered", sessionId: "fixture", brokerVersion: reported });
    assert.equal(client.brokerVersion, expected);
  }
});

test("malformed extension broker messages are rejected", () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";

  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "extension_owner", namespace: "test/v1", ownerId: "owner" }),
    /Invalid extension_owner/,
  );
  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "extension_owner", namespace: "test/v1", ownerEpoch: "epoch" }),
    /Invalid extension_owner/,
  );
  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "extension_message", namespace: "test/v1" }),
    /Invalid extension_message/,
  );
  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "extension_state", namespace: "test/v1", revision: -1 }),
    /Invalid extension_state/,
  );
  assert.throws(
    () => (client as any).handleBrokerMessage({ type: "extension_state_result", namespace: "test/v1", committed: "yes", revision: 1 }),
    /Invalid extension_state_result/,
  );
  assert.doesNotThrow(() => (client as any).handleBrokerMessage({
    type: "extension_message",
    namespace: "test/v1",
    fromSessionId: "session-2",
    payload: { peerOnly: true },
  }));
});

test("pending ask query negotiates feature and validates versioned response", async () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  (client as any)._features = new Set(["pending-asks-v1"]);
  let sent: any;
  (client as any).socket = {
    destroyed: false,
    writableEnded: false,
    writable: true,
    write(data: Buffer) {
      sent = JSON.parse(data.subarray(4).toString());
      queueMicrotask(() => (client as any).handleBrokerMessage({
        type: "pending_asks",
        requestId: sent.requestId,
        version: 1,
        asks: [{
          askId: "ask-1",
          messageId: "ask-1",
          asker: { sessionId: "session-1", name: "a" },
          target: { sessionId: "session-2", name: "b" },
          question: "Question?",
          createdAt: 1,
          expiresAt: 2,
        }],
      }));
    },
  };
  const asks = await client.listPendingAsks();
  assert.equal(sent.type, "pending_asks");
  assert.equal(sent.version, 1);
  assert.equal(asks[0]?.messageId, "ask-1");
});

test("pending ask query safely returns empty for an older broker", async () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  (client as any)._features = new Set();
  assert.deepEqual(await client.listPendingAsks(), []);
});

test("pending ask response rejects schema-invariant violations", () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  assert.throws(
    () => (client as any).handleBrokerMessage({
      type: "pending_asks",
      requestId: "request-1",
      version: 1,
      asks: [{
        askId: "different-id",
        messageId: "message-1",
        asker: { sessionId: "session-1", name: null },
        target: { sessionId: "session-2", name: null },
        question: "Question?",
        createdAt: 1,
        expiresAt: 2,
        scopeId: " scope-with-padding ",
      }],
    }),
    /Invalid pending asks message/,
  );
});

test("message status query negotiates and returns transport-only evidence", async () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  (client as any)._features = new Set(["message-status-v1"]);
  let sent: any;
  (client as any).socket = {
    destroyed: false,
    writableEnded: false,
    writable: true,
    write(data: Buffer) {
      sent = JSON.parse(data.subarray(4).toString());
      queueMicrotask(() => (client as any).handleBrokerMessage({
        type: "message_status",
        requestId: sent.requestId,
        version: 1,
        status: {
          messageId: "message-1",
          delivery: "socket_delivered",
          outcomeKnown: true,
          retryable: false,
          execution: "unknown",
          completion: "unknown",
          replyState: "pending",
          receiverReceipt: { messageId: "message-1", status: "injected", timestamp: 2 },
        },
      }));
    },
  };
  const status = await client.getMessageStatus("message-1");
  assert.equal(sent.type, "message_status");
  assert.equal(sent.version, 1);
  assert.equal(status.delivery, "socket_delivered");
  assert.equal(status.receiverReceipt?.status, "injected");
  assert.equal(status.execution, "unknown");
  assert.equal(status.completion, "unknown");
});

test("cancelAsk ignores synchronous socket write failures", () => {
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  (client as any).socket = {
    destroyed: false,
    writableEnded: false,
    writable: true,
    write() {
      throw new Error("write failed");
    },
  };

  assert.doesNotThrow(() => client.cancelAsk("ask-1"));
});

test("send timeout resolves as UNKNOWN instead of throwing", async () => {
  const previous = process.env.PI_INTERCOM_SEND_TIMEOUT_MS;
  process.env.PI_INTERCOM_SEND_TIMEOUT_MS = "20";
  const client = new IntercomClient();
  (client as any)._sessionId = "session-1";
  (client as any).socket = {
    destroyed: false,
    writableEnded: false,
    writable: true,
    write() {
      // Synthetic lost broker response: the authored frame leaves the client,
      // but no delivery result ever returns.
    },
  };
  try {
    const result = await client.send("session-2", { messageId: "send-timeout", text: "synthetic" });
    assert.deepEqual(result, {
      id: "send-timeout",
      delivered: false,
      delivery: "unknown",
      retryable: true,
      outcomeKnown: false,
      code: "E_SEND_TIMEOUT",
      reason: "Send request timed out; delivery outcome is UNKNOWN and the message may still arrive. Do not retry the same message id.",
    });
  } finally {
    if (previous === undefined) delete process.env.PI_INTERCOM_SEND_TIMEOUT_MS;
    else process.env.PI_INTERCOM_SEND_TIMEOUT_MS = previous;
  }
});
