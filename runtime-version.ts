import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { getAgentDirPath } from "./broker/paths.ts";

// Captured at module load, not repeatedly read from a mutable disk manifest.
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version?: unknown };
export const LOADED_INTERCOM_VERSION = normalizeRuntimeVersion(manifest.version);

export function normalizeRuntimeVersion(value: unknown): string | undefined {
  return typeof value === "string" && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(?:-fork\.[1-9]\d{0,5})?$/.test(value) ? value : undefined;
}

export function isNewerRuntime(candidate: unknown, current: unknown): boolean {
  const a = normalizeRuntimeVersion(candidate); const b = normalizeRuntimeVersion(current);
  if (!a || !b) return false;
  const parts = (version: string) => version.replace("-fork.", ".").split(".").map(Number);
  const left = parts(a); const right = parts(b);
  // Do not infer that a community/fork identity switch is an upgrade on the same base.
  if (left.slice(0, 3).every((n, i) => n === right[i]) && left.length !== right.length) return false;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if ((left[i] ?? 0) !== (right[i] ?? 0)) return (left[i] ?? 0) > (right[i] ?? 0);
  }
  return false;
}

export function runtimeLabel(value: unknown): string {
  return `Intercom ${normalizeRuntimeVersion(value) ?? "unknown"}`;
}

/** Read only the one selected local package manifest; never invoke git/npm or resolve credentials. */
export function selectedLocalRuntimeVersion(agentDir = getAgentDirPath()): string | undefined {
  try {
    const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8")) as { packages?: unknown };
    if (!Array.isArray(settings.packages)) return undefined;
    const versions: string[] = [];
    for (const item of settings.packages) {
      const source = typeof item === "string" ? item : item && typeof item === "object" ? (item as { source?: unknown }).source : undefined;
      if (typeof source !== "string" || !source.includes("pi-intercom") || source.startsWith("git:") || source.startsWith("npm:") || /^https?:/.test(source)) continue;
      const root = isAbsolute(source) ? source : resolve(agentDir, source);
      const file = join(root, "package.json");
      if (!existsSync(file)) continue;
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: unknown; version?: unknown };
      if (pkg.name !== "pi-intercom") continue;
      const version = normalizeRuntimeVersion(pkg.version);
      if (version) versions.push(version);
    }
    return versions.length === 1 ? versions[0] : undefined;
  } catch { return undefined; }
}

export function createPeerUpgradeAdvisories(loaded = LOADED_INTERCOM_VERSION) {
  const seen = new Set<string>();
  return (peerId: string, candidate: unknown): string | undefined => {
    const version = normalizeRuntimeVersion(candidate);
    if (version && !isNewerRuntime(loaded, version)) return undefined;
    const key = `${peerId}:${version ?? "unknown"}`;
    if (seen.has(key)) return undefined;
    if (seen.size >= 16) seen.delete(seen.values().next().value!);
    seen.add(key);
    return `${version ? `Peer reports older Intercom ${version}` : "Peer Intercom runtime is unknown (possibly an older client/broker); do not assume it is outdated"}. This sender loaded ${loaded}. If cross-version behavior matters, use one ordinary authorized Intercom message to ask the peer AI to check its loaded version and arrange the reviewed upgrade at a safe idle point. Do not interrupt active work, repeatedly request upgrade, or treat disk selection/message delivery as upgrade confirmation.`;
  };
}

export function createRuntimeAdvisories(loaded = LOADED_INTERCOM_VERSION) {
  const seen = new Set<string>();
  return (candidate: unknown, source: "peer" | "selection"): string | undefined => {
    if (!isNewerRuntime(candidate, loaded)) return undefined;
    const version = normalizeRuntimeVersion(candidate)!;
    if (seen.has(version)) return undefined;
    if (seen.size >= 16) seen.delete(seen.values().next().value!);
    seen.add(version);
    return `Intercom runtime ${loaded} is older than ${source === "peer" ? "the peer-reported" : "the locally selected"} ${version}. Prefer the reviewed current installation, but preserve the current task and active children; check /intercom status and arrange reload/restart only at a safe idle point. A disk selection, sent notice or peer claim does not prove this runtime upgraded, and this advice grants no new execution authority.`;
  };
}

