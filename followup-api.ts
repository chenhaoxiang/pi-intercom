import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { MessageStatus } from "./types.ts";

/** Trusted process-local composition with pi-schedule-prompt; never a broker permission. */
export const FOLLOWUP_SCHEDULE_EVENT = "schedule:reply-followup:v1";
export const FOLLOWUP_DUE_EVENT = "schedule:reply-followup-due:v1";
export const FOLLOWUP_CANCEL_TRANSPORT_EVENT = "schedule:reply-followup-cancel-transport:v1";
export const FOLLOWUP_OBSERVED_EVENT = "intercom:followup-observed:v1";

export interface FollowupBinding {
  ownerSessionId: string;
  intercomSessionId: string;
  peerSessionId: string;
  messageId: string;
}
export interface FollowupOptions {
  requestId: string;
  goal: string;
  phase: string;
  deadlineAt: string;
  intervalMs: number;
  maxRuns: number;
  expiresAt: string;
  coveredBy?: string;
}
export type FollowupState = "pending" | "dispatched" | "answered" | "cancelled" | "unknown";
export interface FollowupResult {
  ok: boolean;
  jobId?: string;
  created?: boolean;
  state?: FollowupState;
  enabled?: boolean;
  pending?: boolean;
  reason?: string;
  completion?: "unknown";
}
export interface FollowupScheduleRequest {
  version: 1;
  action: "create" | "get" | "cancel";
  binding: FollowupBinding;
  options?: FollowupOptions;
  claim(): void;
  respond(result: FollowupResult): void;
}
export interface FollowupRecord extends FollowupBinding {
  version: 1;
  requestId: string;
  goal: string;
  phase: string;
  deadlineAt: string;
  intervalMs: number;
  maxRuns: number;
  expiresAt: string;
  state: FollowupState;
  createdAt: string;
  updatedAt: string;
  coveredBy?: string;
}
export interface FollowupCancelTransportRequest {
  version: 1;
  ownerSessionId: string;
  intercomSessionId: string;
  peerSessionId: string;
  originalMessageId: string;
  reminderMessageId: string;
}
export interface FollowupDueRequest {
  version: 1;
  binding: FollowupBinding;
  record: FollowupRecord;
  jobId: string;
  claimId: string;
  claim(): void;
  isCurrent(): boolean;
  respond(result: { delivered: boolean; messageId?: string; reason?: string; unknown?: boolean }): void;
}
export type FollowupObservation =
  | { version: 1; kind: "reply"; ownerSessionId: string; intercomSessionId: string; peerSessionId: string; messageId: string; replyTo: string; text?: string; at: number }
  | { version: 1; kind: "disconnected"; ownerSessionId: string; intercomSessionId: string; at: number };

export function requestFollowup(pi: Pick<ExtensionAPI, "events">, action: FollowupScheduleRequest["action"], binding: FollowupBinding, options?: FollowupOptions): Promise<FollowupResult> {
  return new Promise(resolve => {
    let claimed = false;
    let settled = false;
    const finish = (result: FollowupResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, state: "unknown", reason: "Follow-up schedule readback timed out; do not resend the original business request", completion: "unknown" }), 10_000);
    const request: FollowupScheduleRequest = { version: 1, action, binding, options,
      claim: () => { claimed = true; }, respond: finish };
    pi.events.emit(FOLLOWUP_SCHEDULE_EVENT, request);
    if (!claimed) finish({ ok: false, state: "unknown", reason: "pi-schedule-prompt with reply-followup support is not loaded; no timer was created", completion: "unknown" });
  });
}

export function followupStatusText(request: Pick<FollowupDueRequest, "binding" | "record">): string {
  return [
    "[Bounded Intercom status check — NOT a replay or new business authorization]",
    `Original session: ${request.binding.intercomSessionId}`,
    `Original messageId: ${request.binding.messageId}`,
    `Request: ${request.record.requestId}; phase: ${request.record.phase}`,
    `Goal reference: ${JSON.stringify(request.record.goal)}`,
    "Report current status/evidence for this exact request only. Do not repeat the original business action, create a replacement executor, or infer failure from silence.",
    "ACK/PENDING closes this reply-wait only; it is not business completion. Give a concrete next checkpoint when work is still pending.",
  ].join("\n");
}
