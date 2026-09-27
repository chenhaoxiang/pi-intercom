import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVERY_TIMEOUT_MS } from "./cross-machine-discovery.ts";
import {
  DELIVERY_TIMEOUT_MS,
  sendCrossMachine,
  type CommandRunner,
} from "./cross-machine-transport.ts";

const fakeSessionId = "00000000-0000-4000-8000-000000000001";
const machines = JSON.stringify([{ label: "workstation", target: "workstation.example", enabled: true }]);
const agents = JSON.stringify({ id: "cli:agent:list", result: { agents: [{
  agent: "pi",
  name: "reviewer",
  agent_session: { agent: "pi", kind: "path", source: "herdr:pi", value: `/home/user/.pi/agent/sessions/session_${fakeSessionId}.jsonl` },
}] } });

test("discovers machines in parallel and relays with configured command and timeouts", async () => {
  const calls: Array<{ command: string; args: string[]; stdin?: string; timeoutMs?: number }> = [];
  let activeDiscovery = 0;
  let peakDiscovery = 0;
  const run: CommandRunner = async (command, args, stdin, timeoutMs) => {
    calls.push({ command, args, stdin, timeoutMs });
    if (command === "herdr" && args[0] === "machine") {
      return { code: 0, stdout: JSON.stringify([
        { label: "laptop", target: "laptop.example", enabled: true },
        { label: "workstation", target: "workstation.example", enabled: true },
        { label: "disabled", target: "disabled.example", enabled: false },
      ]), stderr: "" };
    }
    if (command === "herdr") {
      activeDiscovery += 1;
      peakDiscovery = Math.max(peakDiscovery, activeDiscovery);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeDiscovery -= 1;
      return args[1] === "workstation" ? { code: 0, stdout: agents, stderr: "" } : { code: 0, stdout: JSON.stringify({ result: { agents: [] } }), stderr: "" };
    }
    return { code: 0, stdout: '{"ok":true}', stderr: "" };
  };
  const result = await sendCrossMachine("reviewer", "hello", { name: "worker", sessionId: fakeSessionId, machine: "laptop" }, {
    run,
    herdrBin: "herdr",
    remoteCommand: "pi-intercom",
    remoteCommandByMachine: { workstation: "/opt/tools/pi-intercom" },
  });
  assert.equal(result.machine.label, "workstation");
  assert.equal(peakDiscovery, 2);
  assert.equal(calls.some((call) => call.args.includes("disabled")), false);
  const ssh = calls.at(-1)!;
  assert.deepEqual(ssh.args, ["workstation.example", "/opt/tools/pi-intercom relay --envelope-stdin --json"]);
  assert.equal(ssh.timeoutMs, DELIVERY_TIMEOUT_MS);
  assert.equal(calls.filter((call) => call.command === "herdr").every((call) => call.timeoutMs === DISCOVERY_TIMEOUT_MS), true);
});

test("non-JSON remote output reports incompatible relay support", async () => {
  const run: CommandRunner = async (command, args) => {
    if (args[0] === "machine") return { code: 0, stdout: machines, stderr: "" };
    if (command === "herdr") return { code: 0, stdout: agents, stderr: "" };
    return { code: 1, stdout: "", stderr: "unknown command: relay" };
  };
  await assert.rejects(
    sendCrossMachine("reviewer", "hi", { name: "worker", sessionId: fakeSessionId, machine: "laptop" }, { run, herdrBin: "herdr" }),
    /no compatible relay support and needs upgrading/,
  );
});
