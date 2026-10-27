---
doc_type: design
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-27
owner: chx
---

# Bounded message failure and timeout semantics

## Problem

A peer can be present in the Intercom roster and report `idle` while a message is only delivered to its socket, received by the extension, held for a safe turn boundary, or injected without starting a model turn. A blocking `ask` can therefore leave its caller waiting even though the peer is idle, disconnected, or unable to act. Transport delivery and model/business execution are different evidence classes.

## Contract

- `socket_delivered` and `queued` are transport states. Receiver receipts (`receiver_received`, `acknowledged`, `queued`, `injected`) are receiver-side observations. None proves model execution or business completion.
- Missing, timed-out, or ambiguous delivery results are represented as `delivery: "unknown"`, `outcomeKnown: false`, and the visible `state: "UNKNOWN"` marker. The original message may still arrive; retrying the same message ID is unsafe.
- `intercom({ action: "status", messageId })` performs a bounded broker query instead of reading only the caller's in-memory receipt. It returns the latest retained receiver receipt when available and always keeps `execution` and `completion` as `unknown`.
- `ask` accepts a bounded per-request `timeoutMs`. When the waiter expires, it returns `E_ASK_TIMEOUT` with the original message ID and status evidence; the original ask is not cancelled or replayed automatically.
- `ask` may specify one explicit `escalateTo` alternate owner. On timeout, Intercom sends at most one new `wake:true` status notification containing the original ID, last transport observation, and an instruction to reconcile before takeover. This is a new coordination notification, not a retry of the original business action.
- A disconnected, idle, or unresponsive peer does not block unrelated sends, status queries, or other tasks. The caller must use a separate status/evidence path rather than waiting indefinitely for an echo.

## Compatibility and bounds

The broker advertises `message-status-v1`; older brokers receive the existing behavior and the client reports `E_STATUS_UNSUPPORTED` as `UNKNOWN`. Delivery records and receiver receipts remain bounded by the broker's existing one-hour delivery retention; status after retention is explicitly unknown. A send response timeout is bounded by `PI_INTERCOM_SEND_TIMEOUT_MS` (default 10 seconds, maximum 10 seconds). Escalation delivery is bounded to 5 seconds and does not retry.

`idle` is presence metadata, not an execution receipt. `wake:true` is sender intent and remains subject to receiver policy (`inboundTrigger`, busy delivery, host lifecycle and idle-wake reservation). No polling loop, broker restart, session termination, private history scan, credential access, or automatic business-action replay is introduced.

## Rollback and use

Rollback is the prior maintained package/release (currently `0.18.0-fork.3`): stop using `timeoutMs`/`escalateTo`, restore the prior package, and reload only a safe dedicated session. Do not kill the shared broker or force reload active business sessions. The source change can be reverted as one commit; existing legacy peers continue to use the pre-feature transport contract.

For operations, send an explicit task with `wake:true` or use `ask` with a finite `timeoutMs`. On timeout, record the returned `messageId`, query `status` independently, inspect the receiver receipt, and only then decide whether an authorized alternate owner should take over. Never treat an idle roster row, delivery receipt, or opening acknowledgement as completion evidence.
