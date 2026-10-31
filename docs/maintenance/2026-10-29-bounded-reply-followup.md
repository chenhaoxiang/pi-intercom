---
doc_type: design
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-29
owner: chx
---

# Bounded reply follow-up composition

## Contract

`intercom({ action: "ask", followUp: ... })` remains a bounded blocking ask and optionally creates one exact-message-bound status follow-up through the already-installed `pi-schedule-prompt` extension. The binding includes the owner session, Intercom session, peer session, original `messageId`, request id, goal and phase. The follow-up requires a finite `afterMs`, future `expiresAt`, and `maxRuns=1`; a new phase requires a new binding. `coveredBy` is only a dedup/readback guard for an existing bounded schedule and never starts a second recurring loop.

An exact inbound reply (`replyTo === original messageId` and exact peer id) resolves the local reply waiter and requests cancellation/readback for the matching follow-up. A normal message, a reply to another message, or a same-name peer cannot cancel it. If cancellation races with dispatch, the persisted outcome is `unknown` and the reminder is not replayed. If a reminder message was already accepted, the schedule seam asks Intercom to cancel the exact reminder message; a cancellation request is not proof that it was never processed.

The reminder is a status-only message. It includes the original message id, request/goal/phase and current transport evidence, but never the original business body or a new authorization. ACK/PENDING closes only the reply wait; business execution and completion remain `unknown`. The next checkpoint must be a separate explicit phase binding.

## Failure and runtime boundaries

Missing schedule support, broker disconnect, restart, late reply, status-query timeout and uncertain transport preserve an `unknown` result. `delivered`, `receiver_received`, `injected`, `wake_requested`, idle presence and an opening ACK are transport/progress observations only; they are never converted to model start or business completion. No original action is retried, no global supervisor or approval ledger is created, and no shared broker is restarted.

The tool-facing contract is intentionally self-healing for optional controls: blank `escalateTo`, null/empty reminder metadata, and malformed optional `followUp` values are omitted with a `parameterWarnings` result while the primary ask is sent once. A warning is not permission to resend. A malformed primary target/message still fails closed. If an ask is cancelled after its message id is allocated, the result is `E_ASK_CANCELLED` with transport evidence and `state: "UNKNOWN"`; callers inspect `status` rather than replaying the ask.

If a receiver answers an ask after the sender has cancelled its waiter, the broker may reject the old `replyTo` edge with `E_REPLY_TARGET`. The reply tool then sends exactly one ordinary response to the exact original sender, marks `fallback: "ordinary_send"` and `replyTargetState: "UNKNOWN"`, and never claims that the stale reply edge or original business action completed. Callers must not retry a response that reports this fallback.

## Parameter correction contract (fork.4)

The existing single `intercom` tool requests provider-preferred strict JSON Schema sampling. On supported hosts, optional JSON null values are restored to omission before execution; placeholder strings such as `unused`, `:omit`, `undefined` and `null` are not omission. The tool validates action-specific fields, required target/message values and routing IDs before connecting. Parameter failures return model-visible JSON with `E_INTERCOM_INVALID_PARAMETERS`, `field`, `reason`, `corrections`, `state: "NOT_SENT"` and `retryPolicy: "CORRECT_ARGUMENTS_ONCE"`. The correction is advice, not an automatic resend or permission to change the intended recipient/action. The result does not echo the business message body.

A reply ID that cannot be resolved is also rejected with correction JSON before a send attempt; it is never silently removed to turn the response into a notification. Existing valid exact-sender reply fallback and all post-allocation `UNKNOWN` outcomes remain unchanged. Provider-free tests exercise the SDK Responses adapter, host argument normalization, the public tool and synthetic broker, but do not prove every remote provider accepts the schema.

## Follow-up runtime/context hardening (local candidate)

The Intercom tool now performs an action-specific preflight before connecting, then constructs a minimal action-specific argument object for direct tool/codemode execution. Nullable optional fields and empty attachment arrays are omitted; non-null unsupported fields, placeholder IDs and missing required routing/message fields remain fail-closed with `NOT_SENT` correction JSON. The requested action, target, message, wake bit and real routing IDs are not rewritten.

Runtime-version upgrade advice now uses the UI-only maintenance notification path rather than appending a model-context message. No request-local projection of existing messages is performed: ordinary notices, attachments, replies, raw history, cached prefixes and opaque checkpoint replay remain unchanged. `intercom status` now reports selected/loaded runtime and local idle/queue/held-message/pending-ask facts; it does not certify child settlement or authorize an automatic reload.

This source change does not install packages, reload active sessions, or prove live business delivery. Provider-free tests and isolated synthetic sessions are the source validation boundary; installation, runtime loading and live acceptance are separate evidence.
