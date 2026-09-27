const SESSION_ID_IN_PATH = /_([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i;
export const DISCOVERY_TIMEOUT_MS = 5_000;

export interface SavedMachine {
  label: string;
  target: string;
  enabled: boolean;
}

export interface RemoteAgent {
  name: string;
  sessionId?: string;
}

export interface DiscoveredRemoteAgent {
  machine: SavedMachine;
  agent: RemoteAgent;
}

export interface DiscoveryDeps {
  run: (command: string, args: string[], stdin?: string, timeoutMs?: number) => Promise<{
    stdout: string;
    stderr: string;
    code: number;
    timedOut?: boolean;
  }>;
  herdrBin: string;
  discoveryTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonOutput(raw: string, operation: string): unknown {
  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed) && "result" in parsed) return parsed.result;
    return parsed;
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
}

export function parseSavedMachines(raw: string): SavedMachine[] {
  const value = parseJsonOutput(raw, "herdr machine list");
  const rows = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.machines) ? value.machines : [];
  return rows.flatMap((row): SavedMachine[] => {
    if (!isRecord(row) || typeof row.label !== "string" || typeof row.target !== "string") return [];
    return [{ label: row.label, target: row.target, enabled: row.enabled !== false }];
  });
}

export function parseRemoteAgents(raw: string): RemoteAgent[] {
  const value = parseJsonOutput(raw, "herdr agent list");
  const rows = isRecord(value) && Array.isArray(value.agents) ? value.agents : [];
  return rows.flatMap((row): RemoteAgent[] => {
    if (!isRecord(row) || row.agent !== "pi" || typeof row.name !== "string") return [];
    const agentSession = isRecord(row.agent_session) ? row.agent_session : undefined;
    const sessionPath = agentSession?.kind === "path" && typeof agentSession.value === "string" ? agentSession.value : undefined;
    const sessionId = sessionPath?.match(SESSION_ID_IN_PATH)?.[1];
    return [{ name: row.name, ...(sessionId ? { sessionId } : {}) }];
  });
}

function splitExplicitMachine(target: string, machines: SavedMachine[]): { agentTarget: string; machines: SavedMachine[] } {
  const at = target.lastIndexOf("@");
  if (at <= 0) return { agentTarget: target, machines };
  const agentTarget = target.slice(0, at);
  const label = target.slice(at + 1).toLowerCase();
  const selected = machines.filter((machine) => machine.label.toLowerCase() === label);
  return { agentTarget, machines: selected.length ? selected : machines };
}

export async function discoverRemoteAgent(target: string, deps: DiscoveryDeps): Promise<DiscoveredRemoteAgent> {
  const discoveryTimeoutMs = deps.discoveryTimeoutMs ?? DISCOVERY_TIMEOUT_MS;
  const listed = await deps.run(deps.herdrBin, ["machine", "list", "--json"], undefined, discoveryTimeoutMs);
  if (listed.code !== 0) throw new Error(`Could not list Herdr saved machines: ${listed.timedOut ? "timed out" : listed.stderr.trim() || `exit ${listed.code}`}`);
  const available = parseSavedMachines(listed.stdout).filter((machine) => machine.enabled);
  const explicit = splitExplicitMachine(target, available);

  const discovered = await Promise.all(explicit.machines.map(async (machine) => {
    const result = await deps.run(deps.herdrBin, ["--machine", machine.label, "agent", "list"], undefined, discoveryTimeoutMs);
    if (result.code !== 0) return { machine, agents: [] as RemoteAgent[], unreachable: true };
    try {
      return { machine, agents: parseRemoteAgents(result.stdout), unreachable: false };
    } catch {
      return { machine, agents: [] as RemoteAgent[], unreachable: true };
    }
  }));

  const matches = discovered.flatMap(({ machine, agents }) => agents
    .filter((agent) => agent.name.toLowerCase() === explicit.agentTarget.toLowerCase() || agent.sessionId === explicit.agentTarget)
    .map((agent) => ({ machine, agent })));
  const unreachable = discovered.filter((entry) => entry.unreachable).map((entry) => entry.machine.label);
  const unreachableSuffix = unreachable.length ? ` Unreachable machines: ${unreachable.join(", ")}.` : "";
  if (matches.length === 0) throw new Error(`No saved Herdr machine has a live Pi agent matching "${target}".${unreachableSuffix}`);
  if (matches.length > 1) throw new Error(`Multiple saved Herdr machines have an agent matching "${target}"; use name@machine.`);

  return matches[0]!;
}
