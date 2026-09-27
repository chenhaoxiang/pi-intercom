import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverRemoteAgent,
  parseRemoteAgents,
  parseSavedMachines,
} from "./cross-machine-discovery.ts";
import type { CommandRunner } from "./cross-machine-transport.ts";

const fakeSessionId = "00000000-0000-4000-8000-000000000001";
const machines = JSON.stringify([{ label: "workstation", target: "workstation.example", enabled: true }]);
const agents = JSON.stringify({ id: "cli:agent:list", result: { agents: [{
  agent: "pi",
  name: "reviewer",
  agent_session: { agent: "pi", kind: "path", source: "herdr:pi", value: `/home/user/.pi/agent/sessions/session_${fakeSessionId}.jsonl` },
}] } });

test("parses saved machines and remote Pi identities", () => {
  assert.deepEqual(parseSavedMachines(machines), [{ label: "workstation", target: "workstation.example", enabled: true }]);
  assert.deepEqual(parseRemoteAgents(agents), [{ name: "reviewer", sessionId: fakeSessionId }]);
});

test("name@machine selects its label and falls back to all machines when the label is unknown", async () => {
  const labels: string[] = [];
  const run: CommandRunner = async (command, args) => {
    if (args[0] === "machine") return { code: 0, stdout: machines, stderr: "" };
    if (command === "herdr") {
      labels.push(args[1]!);
      return { code: 0, stdout: agents, stderr: "" };
    }
    return { code: 0, stdout: '{"ok":true}', stderr: "" };
  };
  await discoverRemoteAgent("reviewer@workstation", { run, herdrBin: "herdr" });
  await discoverRemoteAgent("reviewer@unknown", { run, herdrBin: "herdr" });
  assert.deepEqual(labels, ["workstation", "workstation"]);
});

test("not-found errors identify unreachable machines", async () => {
  const run: CommandRunner = async (_command, args) => {
    if (args[0] === "machine") return { code: 0, stdout: machines, stderr: "" };
    return { code: 124, stdout: "", stderr: "", timedOut: true };
  };
  await assert.rejects(
    discoverRemoteAgent("reviewer", { run, herdrBin: "herdr" }),
    /Unreachable machines: workstation/,
  );
});
