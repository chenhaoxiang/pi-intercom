import type { CrossMachineOrigin } from "./types.ts";

export type { CrossMachineOrigin } from "./types.ts";

export interface CrossMachineEnvelope {
  version: 1;
  target: string;
  text: string;
  origin: CrossMachineOrigin;
  trust: "ssh-asserted";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function defaultMachineName(host: string): string {
  return host.split(".", 1)[0]!.toLowerCase();
}

export function resolveOrigin(
  sessions: Array<{ id: string; name?: string; runtimeFallbackAlias?: boolean }>,
  fallbackName: string,
  machineName: string,
  excludeSessionId?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): CrossMachineOrigin {
  const envSessionId = env.PI_INTERCOM_SESSION_ID?.trim() || env.PI_SESSION_ID?.trim();
  const source = envSessionId
    ? sessions.find((session) => session.id === envSessionId)
    : sessions.find((session) => session.id !== excludeSessionId && !session.runtimeFallbackAlias && session.name?.toLowerCase() === fallbackName.toLowerCase());
  return {
    name: source?.name?.trim() || fallbackName,
    sessionId: source?.id || envSessionId || "unknown",
    machine: machineName,
  };
}

export function parseRelayEnvelope(raw: string): CrossMachineEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Invalid cross-machine relay envelope JSON.");
  }
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Unsupported cross-machine relay envelope version; upgrade pi-intercom on both machines.");
  }
  if (value.trust !== "ssh-asserted" || typeof value.target !== "string" || typeof value.text !== "string" || !isRecord(value.origin)
    || typeof value.origin.name !== "string" || typeof value.origin.sessionId !== "string" || typeof value.origin.machine !== "string") {
    throw new Error("Invalid cross-machine relay envelope.");
  }
  return value as unknown as CrossMachineEnvelope;
}

export function relaySenderName(origin: CrossMachineOrigin): string {
  return `${origin.name}@${origin.machine}`;
}

export function relayMessage(envelope: CrossMachineEnvelope): string {
  return `[Unverified cross-machine origin]\n${envelope.text}`;
}
