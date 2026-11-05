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

## Replacing an ask without reviving its reply edge (source candidate)

Use the existing exact message identifiers, not question text, display names or a UI close event. After a bounded `ask` wait returns `E_ASK_TIMEOUT`, its `details.messageId` identifies the still-retained request. A timeout alone does not withdraw it. Once that local wait has ended, the original sender can either cancel the old request or explicitly replace it for the same exact peer:

```ts
// Withdraw the old transport request; this is not proof of work rollback.
intercom({ action: "cancel", messageId: "old-ask-id" })

// Alternatively, replace it with a new ask and a new message ID.
intercom({
  action: "ask",
  to: "exact-peer-session-id",
  message: "Replacement question for the already-authorized scope",
  supersedes: "old-ask-id",
  timeoutMs: 30000,
})
```

Cancellation already removes the old broker reply edge and retained pending ask. This candidate makes an accepted same-sender/same-receiver `supersedes` do the same, without marking the old question answered or deleting its delivered content. Previously the receiver dismissed the ask locally, but the broker retained its edge/file: `pending` could resurrect it, restart could rehydrate it, and an old reply still appeared to answer an open request. Rejected replacements do not retire anything. A replacement may be an ordinary `send`; it need not create another ask.

This is a transport relation only: `supersedes` says that this exact new message ID replaces that exact old message ID for this exact sender/receiver route. It is not a business replacement, scope change, authorization renewal or owner result. `cancel` is likewise an explicit transport withdrawal, not proof that already-injected work was revoked or rolled back. Neither action infers an applicable business version from question-owner `workRef`, `stage`, `epoch` or `seq`; no same-work metadata or larger observation sequence can synthesize either relation. The broker's existing transport endpoint checks are separate from these owner observations. Closing, declining or aborting the content-free native question UI is not an Intercom `cancel` or a business revoke.

While the broker still retains the original ask's exact delivery route, an already-authored late reply from its original peer is delivered with `lateReplyTo: old-ask-id`, no `replyTo`, and a `demoted: "late_reply"` receipt. It cannot resolve a newer waiter, mark either request answered, or cancel the newer request's follow-up. The original request/reply reference is preserved for the work owner; whether that answer is applicable, stale, superseded in business terms or still pending is not decided by Intercom. A repeated identical reply message ID reuses the delivery receipt rather than injecting another copy or emitting another follow-up observation. This is bounded transport deduplication, not business exactly-once execution. Ordinary wake policy still applies: an explicitly requested wake remains explicit; a quiet demoted reply does not gain reply-driven wake authority.

The public `reply` tool must still resolve an inbound pending ask. Once a receiver processes a cancellation/supersede control, that old `replyTo` is rejected before sending; do not remove it and retarget the answer to a newer question. The demotion path covers a response already authored/in flight or a sender whose local waiter was cancelled without a receiver control. It is not an answer-adoption API. Broker restart/route expiry can remove late-reply provenance; `E_REPLY_TARGET` and the existing one-ordinary-response fallback remain `UNKNOWN`, not proof of renewed relevance. Only still-pending exact asks are recovered durably.

An unrevoked answer arriving after the local wait timed out keeps its original `replyTo`, not the newer ask's ID. The existing follow-up seam cancels that original binding once; the newer wait and binding remain active. A partial answer or ACK can close this transport reply-wait, but the text stays unchanged and `status` keeps `execution`/`completion: "unknown"`. No transport code parses it as full approval: required sub-items, covered/uncovered references and applicability are owner data. Fresh-owner adoption also remains an owner fact requiring an exact original-question → new-owner relation and usable route; handoff delivery alone is not proof of adoption or success. Remaining questions, partial applicability, fresh-owner adoption and any next phase belong to the work owner.

This slice does **not** cancel an older scheduled follow-up merely because `cancel`/`supersedes` was sent. That timer's retirement/readback needs separate owner composition using the existing schedule seam; do not claim a cancellation receipt proves the timer stopped. The tests substitute the process-local schedule responder, not the Schedule store or timer engine. They exercise actual synthetic broker/client/tool paths, retained pending records, restart, receipt-aware/legacy clients, duplicate replies, invalid replacement peers and partial response text. No public schema, new persistence or question database is introduced.

Desk/rpiv consumption remains the existing content-free native question contract. The `ask_user_question` `opened`/`answer-received`/`closed` and optional declared work association are observations only; they do not create a replace/revoke/late/partial/fresh-owner public contract. In particular, UI close, `declined`, and `aborted` are not business revoke facts; Intercom does not consume `workRef`, `stage`, `epoch` or `seq` to infer one. This candidate therefore adds no field for an applicable version or answer coverage. The owner must supply those facts if a later owner contract needs them.

The broker fix activates only in a broker loading this candidate. It is not retroactive to a healthy older shared broker, and extension reload is not broker activation. On such a broker, explicit `cancel` followed by a new request uses the already-working withdrawal path; preserve `UNKNOWN` for unsupported status queries. Cross-machine lifecycle actions, historical forks, live UI/notification delivery and business answer consumption are outside this evidence. The content-free `ask_user_question` opened/answer-received/closed observation remains independent: closing its UI is not an Intercom cancellation, authorization or completion signal.

## Parameter correction contract (fork.4)

The existing single `intercom` tool requests provider-preferred strict JSON Schema sampling. On supported hosts, optional JSON null values are restored to omission before execution; placeholder strings such as `unused`, `:omit`, `undefined` and `null` are not omission. The tool validates action-specific fields, required target/message values and routing IDs before connecting. Parameter failures return model-visible JSON with `E_INTERCOM_INVALID_PARAMETERS`, `field`, `reason`, `corrections`, `state: "NOT_SENT"` and `retryPolicy: "CORRECT_ARGUMENTS_ONCE"`. The correction is advice, not an automatic resend or permission to change the intended recipient/action. The result does not echo the business message body.

A reply ID that cannot be resolved is also rejected with correction JSON before a send attempt; it is never silently removed to turn the response into a notification. Existing valid exact-sender reply fallback and all post-allocation `UNKNOWN` outcomes remain unchanged. Provider-free tests exercise the SDK Responses adapter, host argument normalization, the public tool and synthetic broker, but do not prove every remote provider accepts the schema.

## Follow-up runtime/context hardening (local candidate)

The Intercom tool now performs an action-specific preflight before connecting, then constructs a minimal action-specific argument object for direct tool/codemode execution. Nullable optional fields and empty attachment arrays are omitted; non-null unsupported fields, placeholder IDs and missing required routing/message fields remain fail-closed with `NOT_SENT` correction JSON. The requested action, target, message, wake bit and real routing IDs are not rewritten.

Runtime-version upgrade advice now uses the UI-only maintenance notification path rather than appending a model-context message. No request-local projection of existing messages is performed: ordinary notices, attachments, replies, raw history, cached prefixes and opaque checkpoint replay remain unchanged. `intercom status` now reports selected/loaded runtime and local idle/queue/held-message/pending-ask facts; it does not certify child settlement or authorize an automatic reload.

This source change does not install packages, reload active sessions, or prove live business delivery. Provider-free tests and isolated synthetic sessions are the source validation boundary; installation, runtime loading and live acceptance are separate evidence.
