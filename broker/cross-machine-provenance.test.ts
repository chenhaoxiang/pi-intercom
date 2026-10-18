import test from "node:test";
import assert from "node:assert/strict";
import { isMessage, messageDeliveryFingerprint } from "./protocol.ts";
import type { CrossMachineProvenance, Message } from "../types.ts";

const origin = { name: "worker", sessionId: "origin-session", machine: "laptop" };
const provenance: CrossMachineProvenance = {
  type: "ssh-relay",
  version: 1,
  trust: "ssh-asserted",
  origin,
};

function messageWith(crossMachine: unknown): unknown {
  return {
    id: "message-1",
    timestamp: 1,
    crossMachine,
    content: { text: "hello" },
  };
}

test("protocol validates the complete SSH relay provenance discriminator and origin", () => {
  assert.equal(isMessage(messageWith(provenance)), true);

  const invalid: unknown[] = [
    { ...provenance, type: "ssh" },
    { ...provenance, type: undefined },
    { ...provenance, version: 2 },
    { ...provenance, version: undefined },
    { ...provenance, trust: "verified" },
    { ...provenance, trust: undefined },
    { ...provenance, origin: undefined },
    { ...provenance, origin: { ...origin, name: 1 } },
    { ...provenance, origin: { ...origin, sessionId: 1 } },
    { ...provenance, origin: { ...origin, machine: 1 } },
  ];
  for (const crossMachine of invalid) {
    assert.equal(isMessage(messageWith(crossMachine)), false, JSON.stringify(crossMachine));
  }

  assert.equal(isMessage({
    ...(messageWith(provenance) as Record<string, unknown>),
    provenance: {
      type: "extension_outbox",
      extensionId: "extension-id",
      extensionName: "Extension",
      requestId: "request-id",
    },
  }), true);
});

test("wake is a validated authored field in replay identity", () => {
  const message = messageWith(provenance) as Message;
  for (const wake of [true, false, undefined]) assert.equal(isMessage({ ...message, wake }), true);
  for (const wake of [null, 0, 1, "false", {}]) assert.equal(isMessage({ ...message, wake }), false);
  const fingerprints = [undefined, false, true].map(wake => messageDeliveryFingerprint({ ...message, wake }, "receiver-session"));
  assert.equal(new Set(fingerprints).size, 3, "same ID cannot change the wake semantics under replay");
});

test("wake protocol metadata validates legacy and modern messages without replay ambiguity", () => {
  const message = messageWith(provenance) as Message;
  assert.equal(isMessage(message), true);
  assert.equal(isMessage({ ...message, wakeProtocol: 1 }), true);
  for (const wakeProtocol of [null, 0, 2, "1", false, {}]) {
    assert.equal(isMessage({ ...message, wakeProtocol }), false);
  }
  assert.notEqual(messageDeliveryFingerprint(message, "receiver-session"),
    messageDeliveryFingerprint({ ...message, wakeProtocol: 1 }, "receiver-session"),
    "legacy and modern defaults have different attention semantics");
});

test("broker replay fingerprints distinguish every asserted origin field", () => {
  const message = messageWith(provenance) as Message;
  const original = messageDeliveryFingerprint(message, "receiver-session");
  for (const [field, value] of [["name", "other"], ["sessionId", "other"], ["machine", "other"]] as const) {
    const changed: Message = {
      ...message,
      crossMachine: { ...provenance, origin: { ...origin, [field]: value } },
    };
    assert.notEqual(messageDeliveryFingerprint(changed, "receiver-session"), original);
  }
});
