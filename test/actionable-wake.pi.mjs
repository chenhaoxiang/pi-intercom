// Optional provider-free regression against an explicit installed Pi 1.3+ host.
// TMPDIR must be short and outside Git/node_modules; see the maintenance report.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";

const hostRoot = process.argv[2];
assert.ok(hostRoot, "Pass the installed host's node_modules/@earendil-works directory");
const source = path.resolve(process.argv[3] ?? fileURLToPath(new URL("..", import.meta.url)));
const brokerSource = path.resolve(process.argv[4] ?? source);
const root = fs.mkdtempSync(path.join(tmpdir(), "piic-native-"));
const agentDir = path.join(root, "agent");
assert.ok(path.join(agentDir, "intercom/broker.sock").length < 100, "Use a shorter project-specific TMPDIR");
fs.mkdirSync(path.join(agentDir, "intercom"), { recursive: true });
process.env.HOME = root;
process.env.USERPROFILE = root;
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_OFFLINE = "1";
process.env.PI_SKIP_VERSION_CHECK = "1";
for (const key of Object.keys(process.env)) {
  if (/^PI_(?:INTERCOM|SUBAGENT|SESSION|PROVIDER|MODEL)/.test(key)) delete process.env[key];
}
const core = await import(pathToFileURL(path.join(hostRoot, "pi-coding-agent/dist/index.js")));
const ai = await import(pathToFileURL(path.join(hostRoot, "pi-ai/dist/index.js")));
const [major, minor] = core.VERSION.split(".").map(Number);
assert.ok(major > 1 || (major === 1 && minor >= 3), "This regression needs native custom-turn support");
const { IntercomClient } = await import(pathToFileURL(path.join(source, "broker/client.ts")));
const { getTsxLoaderPath } = await import(pathToFileURL(path.join(brokerSource, "broker/spawn.ts")));
const broker = spawn(process.execPath, ["--import", pathToFileURL(getTsxLoaderPath()).href, path.join(brokerSource, "broker/broker.ts")], {
  cwd: root, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"],
});
let ready = false;
let stderr = "";
broker.stdout.on("data", (chunk) => { if (chunk.toString().includes("Intercom broker started")) ready = true; });
broker.stderr.on("data", (chunk) => { stderr += chunk; });
const wait = async (predicate, label) => {
  const end = Date.now() + 7000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`Timed out: ${label}\n${stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const gates = [];
const pause = () => {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  const gate = { hit: false, promise, release };
  gates.push(gate);
  return gate;
};
const workers = [];
const sender = new IntercomClient();
const receipts = new Map();
sender.onMessageReceipt((_from, receipt) => receipts.set(receipt.messageId, receipt.status));
async function worker(name, policy = "replies", busyDelivery = "steer") {
  fs.writeFileSync(path.join(agentDir, "intercom/config.json"), JSON.stringify({ inboundTrigger: policy, busyDelivery }));
  const state = { name, calls: [], starts: [], settled: 0, api: undefined, preflight: undefined, settling: undefined, toolPause: undefined, nextResponse: undefined };
  const faux = ai.fauxProvider({ provider: `faux-${name}` });
  faux.setResponses(Array.from({ length: 30 }, () => async (context) => {
    state.calls.push(structuredClone(context.messages));
    const next = state.nextResponse;
    state.nextResponse = undefined;
    return next ? next() : ai.fauxAssistantMessage("Synthetic response; no external request.");
  }));
  const runtime = await core.ModelRuntime.create({ authPath: path.join(root, `${name}-auth.json`), modelsPath: null, refreshOnCreate: false });
  runtime.registerNativeProvider(faux.provider);
  const loader = new core.DefaultResourceLoader({
    cwd: root, agentDir, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalExtensionPaths: [path.join(source, "index.ts")],
    extensionFactories: [{ name: "native-wake-probe", factory: (pi) => {
      state.api = pi;
      pi.on("before_agent_start", async (event) => {
        state.starts.push(event.messageType);
        const gate = state.preflight;
        state.preflight = undefined;
        if (gate) { gate.hit = true; await gate.promise; }
      });
      pi.on("agent_before_settle", async () => {
        const gate = state.settling;
        state.settling = undefined;
        if (gate) { gate.hit = true; await gate.promise; }
      });
      pi.on("agent_settled", () => { state.settled++; });
      pi.registerTool({
        name: "pause_fixture", label: "Pause fixture", description: "Synthetic test barrier", parameters: { type: "object", properties: {} },
        execute: async () => {
          const gate = state.toolPause;
          state.toolPause = undefined;
          if (gate) { gate.hit = true; await gate.promise; }
          return { content: [{ type: "text", text: "Fixture released" }], details: undefined };
        },
      });
    } }],
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const { session } = await core.createAgentSession({
    cwd: root, agentDir, model: faux.getModel(), thinkingLevel: "off", modelRuntime: runtime, resourceLoader: loader,
    noTools: "builtin", sessionManager: core.SessionManager.inMemory(root),
    settingsManager: core.SettingsManager.inMemory({ packages: [], compaction: { enabled: false }, retry: { enabled: false } }),
  });
  state.session = session;
  workers.push(state);
  await session.bindExtensions({ mode: "tui", uiContext: { ...session.extensionRunner.getUIContext(), notify: () => {} } });
  session.setSessionName(name);
  await wait(() => {
    void sender.listSessions().then((sessions) => { state.id = sessions.find((entry) => entry.name === name)?.id; });
    return Boolean(state.id);
  }, `registration ${name}`);
  return state;
}
const custom = (target, text) => target.session.messages.filter((message) => message.role === "custom" && JSON.stringify(message.content).includes(text));
const consumed = (target, text) => target.calls.some((messages) => messages.some((message) => JSON.stringify(message.content).includes(text)));
const finish = (target, count) => wait(() => target.calls.length >= count && target.session.isIdle, `${target.name} model call ${count} settled`);
try {
  await wait(() => ready, "owned fixture broker");
  await sender.connect({ name: "native-fixture-sender", cwd: root, model: "none", pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() });
  const target = await worker("native-target");
  const observed = {};
  const sourceWorker = await worker("relay-source");
  const relay = (event, to, text) => sourceWorker.api.events.emit(event, { to: to.id, requestId: text, message: text });
  await sender.send(target.id, { messageId: "quiet", text: "quiet-only" });
  await wait(() => receipts.get("quiet") === "injected", "quiet injection");
  observed.quietTurns = target.calls.length;
  assert.equal(observed.quietTurns, 0);
  await sender.send(target.id, { messageId: "explicit", text: "explicit-task", wake: true });
  await finish(target, 1);
  await sender.send(target.id, { messageId: "explicit", text: "explicit-task", wake: true });
  await sender.send(target.id, { messageId: "quiet-again", text: "quiet-again", wake: false });
  await wait(() => receipts.get("quiet-again") === "injected", "duplicate/quiet barrier");
  observed.duplicateAndExplicitQuietTurns = target.calls.length - 1;
  assert.equal(observed.duplicateAndExplicitQuietTurns, 0, "duplicate and explicit quiet must not start turns");
  observed.relayTurns = {};
  for (const [index, event] of ["subagent:result-intercom", "subagent:control-intercom"].entries()) {
    const before = target.calls.length;
    relay(event, target, event);
    await finish(target, index + 2);
    assert.ok(consumed(target, event), "remote actionable follow-up reached a model input");
    observed.relayTurns[event] = target.calls.length - before;
    assert.equal(observed.relayTurns[event], 1);
    assert.equal(custom(target, event).length, 1);
  }
  const preflight = pause();
  target.preflight = preflight;
  await sender.send(target.id, { messageId: "starting-first", text: "starting-first", wake: true });
  await wait(() => preflight.hit, "starting barrier");
  await sender.send(target.id, { messageId: "starting-second", text: "starting-second", wake: true });
  await wait(() => receipts.get("starting-second") === "queued", "starting peer held");
  preflight.release();
  await wait(() => consumed(target, "starting-second") && target.session.isIdle, "starting peer consumed");
  assert.ok(consumed(target, "starting-first"));
  observed.startingPeerInjections = custom(target, "starting-second").length;
  assert.equal(observed.startingPeerInjections, 1);

  const settling = pause();
  target.settling = settling;
  const beforeSettleCalls = target.calls.length;
  await sender.send(target.id, { text: "settling-first", wake: true });
  await wait(() => settling.hit, "settling barrier");
  await sender.send(target.id, { messageId: "settling-follow-up", text: "settling-follow-up", wake: true });
  await wait(() => receipts.get("settling-follow-up") === "queued", "settling follow-up held");
  assert.equal(target.session.isStreaming, true, "session remains busy during settling");
  settling.release();
  await wait(() => consumed(target, "settling-follow-up") && target.session.isIdle, "settling follow-up consumed");
  observed.settlingTotalCalls = target.calls.length - beforeSettleCalls;
  observed.settlingFollowUpInjections = custom(target, "settling-follow-up").length;
  assert.equal(observed.settlingTotalCalls, 2);
  assert.equal(observed.settlingFollowUpInjections, 1);

  observed.toolBatchPolicies = [];
  for (const busyDelivery of ["steer", "human-first"]) {
    const busy = await worker(`batch-${busyDelivery}`, "replies", busyDelivery);
    const toolPause = pause();
    busy.toolPause = toolPause;
    busy.nextResponse = () => ai.fauxAssistantMessage(ai.fauxToolCall("pause_fixture", {}), { stopReason: "toolUse" });
    await sender.send(busy.id, { text: "begin-tool-batch", wake: true });
    await wait(() => toolPause.hit, "tool batch blocked");
    const messageId = `batch-result-${busyDelivery}`;
    await sender.send(busy.id, { messageId, text: messageId, wake: true });
    await wait(() => receipts.get(messageId) === (busyDelivery === "human-first" ? "queued" : "injected"), "tool result ordering barrier");
    assert.equal(custom(busy, messageId).length, 0, "peer must not split the tool call and its result");
    toolPause.release();
    await wait(() => consumed(busy, `batch-result-${busyDelivery}`) && busy.session.isIdle, "tool-batch follow-up consumed");
    assert.equal(custom(busy, `batch-result-${busyDelivery}`).length, 1);
    assert.deepEqual(busy.starts, ["custom"], "busy result continues the existing run rather than waking another");
    observed.toolBatchPolicies.push(busyDelivery);
  }

  const never = await worker("never-target", "never");
  relay("subagent:result-intercom", never, "never-remote-result");
  never.api.events.emit("subagent:control-intercom", { to: never.name, message: "never-local-control" });
  await sender.send(never.id, { messageId: "never-explicit", text: "never-explicit", wake: true });
  await wait(() => custom(never, "never-remote-result").length === 1 && receipts.get("never-explicit") === "injected", "never-policy injections");
  assert.equal(custom(never, "never-local-control").length, 1);
  observed.neverTurns = never.calls.length;
  assert.equal(observed.neverTurns, 0);
  for (const entry of workers) {
    assert.ok(entry.starts.every((type) => type === "custom"), "native source must remain custom");
    assert.equal(entry.session.messages.filter((message) => message.role === "user").length, 0, "no synthetic user wake");
  }
  console.log(JSON.stringify({ host: core.VERSION, source, brokerSource, passed: true,
    providerMode: "local faux provider only; no network model provider configured", observed,
    nativeCustomOnly: workers.every(({ starts }) => starts.every((type) => type === "custom")),
    syntheticUserMessages: workers.reduce((sum, { session }) => sum + session.messages.filter((message) => message.role === "user").length, 0),
    workers: workers.map(({ name, calls, starts }) => ({ name, calls: calls.length, starts })),
  }, null, 2));
} finally {
  for (const gate of gates) gate.release();
  for (const entry of workers) {
    await entry.session.abort();
    await entry.session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    entry.session.dispose();
  }
  await sender.disconnect().catch(() => {});
  if (broker.exitCode === null && broker.signalCode === null) {
    broker.kill("SIGTERM");
    await once(broker, "exit").catch(() => {});
  }
  fs.rmSync(root, { recursive: true, force: true });
}
