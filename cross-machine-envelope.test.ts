import test from "node:test";
import assert from "node:assert/strict";
import { isMessage } from "./broker/protocol.ts";
import {
  defaultMachineName,
  parseRelayEnvelope,
  relayMessage,
  relaySenderName,
  resolveOrigin,
} from "./cross-machine-envelope.ts";

const fakeSessionId = "00000000-0000-4000-8000-000000000001";

test("machine names default to the lowercased short hostname", () => {
  assert.equal(defaultMachineName("Build-Host.EXAMPLE"), "build-host");
});

test("operator origin lookup excludes its own transient CLI session", () => {
  const source = { id: fakeSessionId, name: "worker" };
  const transient = { id: "00000000-0000-4000-8000-000000000002", name: "worker" };
  assert.deepEqual(resolveOrigin([transient, source], "worker", "laptop", transient.id, {}), {
    name: "worker", sessionId: fakeSessionId, machine: "laptop",
  });
});

test("message validation accepts structured cross-machine provenance", () => {
  const message = {
    id: "message-1",
    timestamp: 1,
    crossMachine: {
      origin: { name: "worker", sessionId: fakeSessionId, machine: "laptop" },
      trust: "ssh-asserted",
    },
    content: { text: "hello" },
  };
  assert.equal(isMessage(message), true);
  assert.equal(isMessage({ ...message, crossMachine: { ...message.crossMachine, trust: "verified" } }), false);
});

test("relay envelope carries structured origin and a one-line fallback marker", () => {
  const envelope = parseRelayEnvelope(JSON.stringify({
    version: 1,
    target: "reviewer",
    text: "payload",
    trust: "ssh-asserted",
    origin: { name: "worker", sessionId: fakeSessionId, machine: "laptop" },
  }));
  assert.equal(relaySenderName(envelope.origin), "worker@laptop");
  assert.equal(relayMessage(envelope), "[Unverified cross-machine origin]\npayload");
  assert.throws(() => parseRelayEnvelope(JSON.stringify({ ...envelope, version: 2 })), /Unsupported cross-machine relay envelope version/);
});
