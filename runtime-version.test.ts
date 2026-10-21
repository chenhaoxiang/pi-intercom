import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPeerUpgradeAdvisories, createRuntimeAdvisories, isNewerRuntime, normalizeRuntimeVersion, runtimeLabel, selectedLocalRuntimeVersion } from "./runtime-version.ts";
import { isMessage, isSessionInfo, isSessionRegistration } from "./broker/protocol.ts";

test("runtime versions reject display controls and unsupported identities without guessing", () => {
  for (const value of [undefined, null, {}, "0.18.0\n", "\u001b[31m0.18.0", "0.18.0-rc.1", "01.18.0", "0.18.0-fork.0"]) {
    assert.equal(normalizeRuntimeVersion(value), undefined);
    assert.equal(isNewerRuntime(value, "0.18.0-fork.1"), false);
  }
  assert.equal(runtimeLabel(undefined), "Intercom unknown");
  assert.equal(isNewerRuntime("0.18.0-fork.2", "0.18.0-fork.1"), true);
  assert.equal(isNewerRuntime("0.19.0", "0.18.0-fork.2"), true);
  assert.equal(isNewerRuntime("0.18.0", "0.18.0-fork.2"), false);
  assert.equal(isNewerRuntime("0.18.0-fork.2", "0.18.0"), false);
});

test("advice is local, deduplicated and explicitly preserves authority and active work", () => {
  const advice = createRuntimeAdvisories("0.18.0-fork.1");
  assert.equal(advice(undefined, "peer"), undefined);
  assert.equal(advice("0.17.1-fork.7", "peer"), undefined);
  const first = advice("0.18.0-fork.2", "peer");
  assert.match(first!, /peer-reported/);
  assert.match(first!, /safe idle/);
  assert.match(first!, /grants no new execution authority/);
  assert.equal(advice("0.18.0-fork.2", "peer"), undefined);
  assert.equal(advice("0.18.0-fork.2", "selection"), undefined);
});

test("sender guidance uses ordinary messages and never calls an unknown peer old", () => {
  const advice = createPeerUpgradeAdvisories("0.18.0-fork.2");
  assert.match(advice("old", "0.18.0-fork.1")!, /older Intercom/);
  const unknown = advice("legacy", undefined)!;
  assert.match(unknown, /unknown.*do not assume it is outdated/);
  assert.match(unknown, /ordinary authorized Intercom message/);
  assert.equal(advice("legacy", undefined), undefined);
  assert.equal(advice("same", "0.18.0-fork.2"), undefined);
});

test("selected local version is read without rewriting settings or conflating loaded version", () => {
  const dir = mkdtempSync(join(tmpdir(), "intercom-version-"));
  const pkg = join(dir, "packages", "pi-intercom", "new");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "pi-intercom", version: "0.18.0-fork.9" }));
  try {
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ packages: ["packages/pi-intercom/new", "npm:pi-intercom"] }));
    assert.equal(selectedLocalRuntimeVersion(dir), "0.18.0-fork.9");
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ packages: [pkg, pkg] }));
    assert.equal(selectedLocalRuntimeVersion(dir), undefined, "ambiguous selections are not guessed");
    writeFileSync(join(dir, "settings.json"), "{broken");
    assert.equal(selectedLocalRuntimeVersion(dir), undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("additive runtime metadata validates while legacy messages/registrations remain valid", () => {
  const message = { id: "one", timestamp: 1, content: { text: "unchanged" } };
  const session = { id: "a", cwd: "/fixture", model: "fixture", pid: 1, startedAt: 1, lastActivity: 1 };
  for (const version of [undefined, "0.18.0-fork.2"]) {
    assert.equal(isMessage({ ...message, intercomVersion: version }), true);
    assert.equal(isSessionInfo({ ...session, intercomVersion: version }), true);
    assert.equal(isSessionRegistration({ ...session, intercomVersion: version }), true);
  }
  assert.equal(isMessage({ ...message, intercomVersion: "\u001b[31m" }), false);
});
