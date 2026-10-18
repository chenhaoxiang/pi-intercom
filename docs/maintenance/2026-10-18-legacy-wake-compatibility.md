---
doc_type: report
project: workspace
status: active
truth_mode: maintained
created: 2026-10-18
verified: 2026-10-18
verified_by: manual
---

# Mixed-version wake compatibility

## Problem

Before the explicit wake protocol was available, `intercom({ action: "send" })` was also used for task handoffs. The newer default `inboundTrigger: "replies"` treats an ordinary protocol-aware send as context-only. An old sender that omits wake metadata can therefore reach a new receiver successfully while never starting a model turn.

Transport delivery and execution attention are separate facts: `socket_delivered` or `receiver_received` proves receipt by the extension process, not that the receiver started work.

## Compatibility contract

- A current sender stamps every authored message with `wakeProtocol: 1`.
- A current ordinary send remains context-only under `inboundTrigger: "replies"`; it may omit `wake` or set `wake: false` explicitly.
- A current task handoff uses `wake: true`; ask/reply and handover messages remain actionable through their existing fields.
- A message without `wakeProtocol` is from a pre-protocol sender. Under `inboundTrigger: "replies"`, the receiver retains the pre-upgrade implicit-wake behavior so an old task handoff is not silently ignored.
- `wake: false` always suppresses automatic attention; `inboundTrigger: "never"` remains authoritative. `inboundTrigger: "always"` retains its existing behavior for protocol-aware messages unless an explicit `wake: false` opts out.
- The compatibility path does not infer an ask, create a pending reply, or inspect task wording. Duplicate message suppression and ask/reply routing remain unchanged.
- Versions before this marker, including `0.17.1-fork.2`, cannot distinguish a status from a task when both omit wake metadata. Such unmarked traffic retains legacy attention rather than losing tasks; it may still generate status turns until those senders reload. A protocol-aware status sent in response stays quiet, breaking the modern side of notification echo chains. There is no claim that old in-memory receiver code can be hot-patched without a reload.

## Cross-machine boundary

This compatibility fix covers direct same-machine legacy messages. An old cross-machine relay v1 envelope carries no source wake-protocol marker. The target machine relay CLI authors the local broker message, so its client version determines the marker, not the original sender version. A current relay CLI treats v1 as context-only; an older relay CLI can produce unmarked traffic that uses legacy attention. For a remote task use an explicit v2 `wake: true` request and verify the target supports v2. Do not infer remote start from a successful SSH relay. This release does not invent source identity/capability metadata that old v1 envelopes never carried.

## User-visible result

A successful send now reports one of two intent labels in tool details:

- `attention: "context_only"`: transport delivered a context/status message;
- `attention: "wake_requested"`: the message requested receiver attention.

Neither label proves that a model turn or business task has started. The receiver's own policy, liveness and model/provider state still decide that outcome.

## Activation and rollback

The compatibility behavior is source and package behavior in `0.17.1-fork.3`. Installing it affects new sessions and sessions that reload the extension; an already-running Pi process can keep older in-memory extension code. The shared broker is not forcibly stopped as part of installation. Existing old receivers continue their old behavior until they reload; current receivers can safely accept old unmarked senders after the new package is active.

Rollback is the previous fixed release. If a mixed-version problem is diagnosed, first inspect the receiver's package/reload state and the message's `wakeProtocol`/`wake` metadata; do not resend the same message ID as an automatic retry.

## Verification

The provider-free suite covers:

- old unmarked send into a reply-driven receiver;
- current protocol-aware context-only and explicit wake sends;
- inferred replies and ask behavior;
- `never` policy suppressing both legacy and explicit wake;
- duplicate suppression;
- CLI status messages carrying the protocol marker;
- replay identity including wake protocol and wake semantics.

The source suite on 2026-10-18 reports 352 passed, 1 skipped, 0 failed (353 total), using synthetic fixtures and no real provider calls. Existing assertions were preserved. The pre-fix focused run recorded 3 failures and 1 pass.

An additional Pi `1.3.0-fork.1` native-custom-turn smoke passed with both a new isolated broker and the retained `0.17.1-fork.1` broker source. Each run used a faux provider and observed modern status 0 turns, one unmarked legacy task 1 turn, explicit task 1 turn, duplicate replay 0 extra turns, explicit quiet 0 turns, `before_agent_start` source `["custom", "custom"]`, no synthetic user messages and no real provider calls. Only those fixture brokers were started/stopped; the shared live broker and unrelated sessions were untouched. Packed-consumer and real-session activation remain separate release/install evidence.

The unchanged development dependency tree has one high `brace-expansion` finding; production dependencies report zero findings. This change does not update dependencies or claim that the development finding is resolved.
