---
doc_type: bug
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-20
verified: 2026-10-20
verified_by: manual
owner: chx
---

# Actionable result and decision relays

## Diagnosis and scope

Receiving a modern `context-only` status without starting another model turn is intentional. In particular, a notice that says no action or reply is needed is not evidence of a lost wake. A sender that needs the receiver to continue an authorized task must use `wake: true`, `ask`, `reply` or `handover`; ordinary receipt/status notices must not form reply loops. Message delivery, injection, idle presence and a matching reply are not business execution/completion evidence.

There was a separate reproducible defect in Intercom's existing `subagent:result-intercom` and `subagent:control-intercom` relay adapter. Its cross-session path called the modern client without explicit wake intent. The client supplied `wakeProtocol: 1`, so the default reply-driven receiver accepted and injected these actionable follow-ups as context-only and remained idle. The same events on the local path forced a wake and bypassed the receiver's `never` policy.

Fork.7 marks both relay paths with `wakeProtocol: 1` / `wake: true` and reuses the existing common receiver decision. The cross-session client already stamps `wakeProtocol: 1`; fork.7 adds `wake: true` to the relay send, and the synthetic local message carries both explicitly. The local `forceTrigger` escape hatch is removed. An idle eligible receiver starts its normal native custom turn, a busy receiver uses the existing safe delivery boundary, and `never` still suppresses automatic attention. Relay delivery acknowledgements retain their existing transport-only meaning; no pending ask or task outcome is fabricated.

This fixes this adapter, not arbitrary model decisions to stop after reading text. It does not infer action from wording, promote all messages, change core/subagent execution, add polling/collectors, retry model calls, or change broker protocol, scope, cancellation, reply binding, timeout, model or permissions. The existing held-message timer and idle reservation are unchanged.

## Verification

Use a short project-specific temporary directory **outside any Git tree and node_modules ancestor**:

```bash
mkdir -p "$HOME/tmp/piic-wake"
TMPDIR="$HOME/tmp/piic-wake" env -u PI_CODING_AGENT_DIR -u PI_INTERCOM_SCOPE_ID \
  -u PI_INTERCOM_SESSION_ID -u PI_SUBAGENT_ORCHESTRATOR_TARGET \
  -u PI_SUBAGENT_ORCHESTRATOR_SESSION_ID npm test

# HOST is the selected installed Pi 1.3+ node_modules/@earendil-works directory.
# Optional arguments select a packed/installed source and an older broker source.
TMPDIR="$HOME/tmp/piic-wake" node --import tsx test/actionable-wake.pi.mjs "$HOST" [source] [broker-source]
```

- Three new integration regressions failed on the original source for the target defects: both cross-session relays lacked wake intent, and the local relay woke despite `never`. They pass after the fix, including quiet progress, idle wake, busy steer, no manufactured pending ask and transport-only acknowledgement cases.
- The targeted legacy-host run passed 13 tests. The full provider-free suite passed **359 / 1 skipped / 0 failed** (360 total); the skip is the existing live-Herdr case. Locked host dependencies remain Pi 0.87.1, so that suite does not by itself prove native Pi 1.3 behavior.
- The committed optional native smoke uses an explicit installed host, the real resource loader/AgentSession and a local faux provider. Against Pi **1.3.0-fork.1**, the previous installed fork.6 times out waiting for the first cross-session result to reach a model call. The fixed source passes with both its own isolated broker and an isolated broker using retained **fork.5** source.
- Native observations: ordinary status and duplicate replay add zero turns; result and control relays each add one eligible custom turn; explicit wake received during startup and settling is consumed once; both `steer` and `human-first` deliver a peer arriving during a tool batch after tool-result ordering is safe, without starting a second run; local and remote relay traffic under `never` starts zero turns. All starts remain `custom`, synthetic user wakes are zero and real provider calls are zero. The script waits for receiver receipts at busy barriers rather than assuming an emitted relay has already arrived.
- Existing regressions retain explicit ask/reply, legacy unmarked sends, duplicate suppression, shared idle reservation, abort/compaction, restart/reconnect, session replacement and exact/durable reply routing behavior. These tests use only owned synthetic fixtures; no private coordination history or real model prompts are used.

The first native harness attempt released its blocked tool before the relayed message arrived, creating a second idle run. That was a test synchronization defect, not passing evidence or a product regression: the final busy cases use explicit message IDs and receiver `queued`/`injected` receipts before releasing the barrier.

## Release, installation and activation

Candidate version is **0.17.1-fork.7**; retain **fork.6** and its immutable assets for rollback. Source/independent review/PR merge, stable release assets with exact-source provenance, fresh-download checksums, selected disk installation and fresh isolated loading are separate evidence levels. Publish/install outcomes belong in the corresponding immutable release notes; this pre-release source report does not claim those later actions have happened.

Read-only inspection found disk selection fork.6 and a live shared broker from fork.5. The existing public Intercom status/roster does not expose a per-session loaded-source or receiver-policy runtime acknowledgement, so old sessions' in-memory code/policy remains unknown. File fingerprints and configured selection do not establish hot activation. The full native smoke against retained fork.5 broker source establishes this candidate's tested compatibility without restarting that shared process.

Do not kill/restart the shared broker, force reload old sessions or terminate unrelated Pi processes. Only normal new-session/explicit lifecycle transitions activate newly installed extension code. A fresh isolated load is not proof that every existing business session has upgraded, nor proof of business-task completion.
