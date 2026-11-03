---
name: pi-intercom
description: |
  Coordinate with other Pi sessions through the intercom tool: message, ask or
  hand over to a peer in this repo, another repo or another machine; answer asks
  waiting on you and handle escalations from pi-subagents children.
---

# Pi Intercom

Use the tool description for each action's call shape. Coordination does not grant new business or execution authority.

## Choose the right action

```typescript
intercom({ action: "list-cwd" })
intercom({ action: "send", to: "worker", message: "Context update" })
intercom({ action: "send", to: "worker", message: "Continue the authorized task", wake: true })
intercom({ action: "ask", to: "owner", message: "Which compatibility behavior should I retain?" })
intercom({ action: "pending" })
intercom({ action: "reply", replyTo: "exact-inbound-ask-id", message: "Retain it" })
```

- Ordinary `send` is context-only under the fork's default `inboundTrigger: "replies"`. Use `wake:true` for explicit non-blocking work. Use `ask` only for a short decision that blocks this turn, not a minutes-long review or implementation.
- `wake:false` suppresses automatic attention, and local `send` also supports community `noWake:true`. Receiver `never` remains authoritative. Old unmarked clients retain legacy wake behavior.
- `reply` uses the exact inbound hint's `replyTo`; when several asks wait, inspect `pending` and disambiguate. A session ID is not an ask ID. Ordinary inbound messages can get an unthreaded response without a fabricated `replyTo`.
- `send` infers a reply when exactly one pending ask from the actual target waits on you. Zero or multiple matches remain unthreaded. `noWake` is ignored for such a reply.
- `ask` needs a live peer and permits one outstanding ask. Its default timeout is 10 minutes (`PI_INTERCOM_ASK_TIMEOUT_MS`); use per-request `timeoutMs` for a bounded decision.
- Late replies can arrive as ordinary messages marked late, without resolving a closed waiter. A retained legacy broker may instead cause the fork's one exact-sender fallback; `fallback:"ordinary_send"` means the response was already sent once. Do not retry it.

## Keep parameters minimal and recover honestly

- Pass only fields supported by the action. Omit unused optional fields; JSON `null` may normalize to omission, but strings `"unused"`, `":omit"`, `"undefined"` and `"null"` are real values. Never invent IDs or timestamps.
- `E_INTERCOM_INVALID_PARAMETERS` with `state:"NOT_SENT"` means follow `corrections` once, preserving the business intent. A result with `parameterWarnings` already delivered the normalized primary action: do not resend it.
- After a message ID exists, timeout, cancellation or missing transport evidence remains `UNKNOWN`. Use `status` with that exact `messageId`; never blindly replay the original message.
- `ask.escalateTo` and `followUp` are opt-in bounded status notifications, not default delegation fields. A follow-up needs finite `afterMs` (1000–86400000) and an expiry later than its reminder. Do not fabricate these controls for normal calls.
- Delivery, receiver receipt, injection, wake, idle presence and an exact reply do not prove execution or business completion.

## Target peers, not panes

- `to` addresses a session name, full ID or unambiguous prefix; `cwd` scopes directory matching. With multiple peers in that directory, supply `to`. Re-list before reusing a stale target and never target self.
- `name@machine` or `<session-id>@machine` reaches a saved Herdr machine or a host accessible by non-interactive SSH, including SSH config aliases. Only new-text `send` and `handover` are supported across machines: no `ask`, reply relationships, attachments, supersede, retry, `noWake` or cwd/pane routing. SSH-asserted origin is not cryptographically verified.
- Disconnected peers may receive bounded in-memory mailbox sends for 24 hours. The mailbox is lost if the broker exits. Unknown targets are not silently queued.
- For bounded cross-repo work, use a `pi-subagents` child only when delegation is authorized. Open a visible Herdr project pane only for an authorized long-lived peer; do not invent a different terminal fallback.
- `handover` sends a model-written summary of this transcript. If it handled secrets, prefer the human-reviewable `/handover` flow.

## Supervise children and preserve active work

A child reaches its supervisor through `contact_supervisor`. Reply to a blocking decision or interview through the exact displayed request; progress updates need no reply unless the plan changes. A child waiting on you cannot answer a reverse `ask`; put a follow-up question in your `reply` instead.

Loaded extension, selected package and shared broker are separate runtimes. Unknown versions stay unknown. Upgrade advice is bounded and non-triggering; it does not authorize installation or prove a hot reload. Preserve active work, children and history; arrange reload/restart only at a safe idle point. Never kill the shared broker to make a version display green.

## References

- [Configuration and delivery boundaries](../../README.md#configuration)
- [Runtime versions and safe convergence](../../README.md#runtime-versions-and-safe-convergence)
- [Release and installation](../../docs/releasing.md)
