import { types } from "node:util";
import type { MessageRelationsV1, SessionInfo } from "./types.ts";

/** Closed content-free projection; no getters, truncation, parsing of reason text or new query. */
export function snapshotMessageRelations(value: unknown): MessageRelationsV1 | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return;
  const allowed = ["version", "senderSessionId", "recipientSessionId", "supersedes", "supersededBy", "replyTo", "lateReplyTo", "replyCorrelation"];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string" || !allowed.includes(key) || !Object.hasOwn(descriptors[key], "value"))) return;
  const field = (key: string) => descriptors[key]?.value;
  const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) && !id.includes("..");
  if (field("version") !== 1 || !safeId(field("senderSessionId")) || !safeId(field("recipientSessionId"))) return;
  for (const key of ["supersedes", "supersededBy", "replyTo", "lateReplyTo"]) if (field(key) !== undefined && !safeId(field(key))) return;
  const correlation = field("replyCorrelation");
  if (!["none", "matched", "late", "unknown"].includes(correlation)) return;
  if ((field("replyTo") && field("lateReplyTo")) || (correlation === "matched" && !field("replyTo")) ||
    (correlation === "late" && !field("lateReplyTo")) || (correlation === "none" && (field("replyTo") || field("lateReplyTo")))) return;
  return Object.fromEntries(keys.filter(key => field(key as string) !== undefined).map(key => [key, field(key as string)])) as unknown as MessageRelationsV1;
}

export const INTERCOM_EXTENSION_REGISTER_EVENT = "intercom:extension-register";
export const INTERCOM_EXTENSION_REGISTRY_READY_EVENT = "intercom:extension-registry-ready";
export const INTERCOM_OUTBOX_REQUEST_EVENT = "intercom:outbox-request";
export const INTERCOM_OUTBOX_RESULT_EVENT = "intercom:outbox-result";
export const INTERCOM_SESSION_IDENTITY_EVENT = "intercom:session-identity";

/**
 * Emitted on the session's own event bus at session start, before the intercom
 * ID is chosen. An extension that owns this session's routing address (for
 * example a subagent launcher) calls `claim` synchronously; the first non-empty
 * claim becomes this session's intercom ID and wins over `PI_INTERCOM_STABLE_ID`
 * and `stableId`, which are process- and machine-wide. The session name stays
 * free for a human-readable label.
 */
export interface IntercomSessionIdentityRequestV1 {
  version: 1;
  claim(stableId: string): void;
}

export type IntercomOutboxResultStatus = "sent" | "rejected" | "blocked" | "failed";

export type IntercomOutboxResultCode =
  | "user_cancelled"
  | "confirmation_unavailable"
  | "session_unavailable"
  | "session_ended"
  | "invalid_request"
  | "duplicate_request"
  | "target_not_found"
  | "target_ambiguous"
  | "self_target"
  | "delivery_failed";

export interface IntercomOutboxRequestV1 {
  version: 1;
  requestId: string;
  extensionId: string;
  extensionName: string;
  to: string;
  message: string;
}

export type IntercomOutboxRequest = IntercomOutboxRequestV1;

export interface IntercomOutboxResultV1 {
  version: 1;
  requestId: string;
  status: IntercomOutboxResultStatus;
  code?: IntercomOutboxResultCode;
  extensionId?: string;
  extensionName?: string;
  messageId?: string;
  detail?: string;
}

export type IntercomOutboxResult = IntercomOutboxResultV1;

export interface IntercomExtensionOwner {
  sessionId: string;
  epoch: string;
}

export interface IntercomExtensionState {
  revision: number;
  payload: unknown;
}

export type IntercomExtensionEvent =
  | { type: "connection"; connected: boolean; supported: boolean }
  | { type: "owner"; owner?: IntercomExtensionOwner }
  | { type: "message"; fromSessionId: string; owner?: IntercomExtensionOwner; payload: unknown }
  | { type: "state"; state: IntercomExtensionState }
  | { type: "state_result"; committed: boolean; revision: number; reason?: string }
  | { type: "session_joined"; session: SessionInfo }
  | { type: "session_left"; sessionId: string }
  | { type: "presence_update"; session: SessionInfo };

export interface IntercomExtensionChannel {
  readonly namespace: string;
  snapshot(): {
    connected: boolean;
    supported: boolean;
    owner?: IntercomExtensionOwner;
    state?: IntercomExtensionState;
  };
  publish(payload: unknown, options?: { audience?: "owner" | "capable"; ownerOnly?: boolean }): void;
  commitState(payload: unknown, expectedRevision?: number): void;
  listSessions(): Promise<SessionInfo[]>;
  /**
   * Leaves this namespace: frees its per-session slot and hands ownership to the next owner-eligible
   * member. Afterwards `publish` and `commitState` throw and `onEvent` stops; repeated calls are no-ops.
   */
  unregister(): void;
}

export interface IntercomExtensionRegistration {
  namespace: string;
  ownerEligible: boolean;
  onEvent(event: IntercomExtensionEvent): void;
  onReady(channel: IntercomExtensionChannel): void;
}
