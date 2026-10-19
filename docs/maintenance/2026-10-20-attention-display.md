---
doc_type: report
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-20
owner: chx
---

# Existing attention and receipt display

The sender already records explicit wake intent and exact reply binding. This slice makes those existing facts visible in collapsed outgoing tool results, inbound metadata and message cards; it does not change delivery or start additional turns.

- `context-only`: explicit `wake:false`, or an ordinary protocol-aware send without a wake/ask/reply request.
- `wake-requested`: an explicit wake request, ask or exact reply, unless `wake:false` overrides it. This is sender intent, not the receiver's policy or evidence that a model/tool began work.
- `unknown`: a legacy unmarked message whose sender intent is not explicit.
- `intercom({action:"status", messageId:"…"})` optionally shows the existing latest outbound transport receipt cached in this runtime. Missing receipts stay unknown. It does not query private coordination history or create a durable status store.

Transport received/acknowledged/queued/injected, `agent_start` for an unrelated turn, arbitrary reply text, and a matching `replyTo` are not task-outcome evidence. Execution and completion therefore remain **unknown** in these displays. This version deliberately does not invent `started`, `done` or `no-action`; those require independent message-bound evidence. A cancellation request is not proof that execution was cancelled. Existing receipt states, broker protocol, human priority, wake reservation and exact-sender/durable-reply routing are unchanged.

No new collector, ledger, polling loop, broker migration/restart, acknowledgement echo, LLM call or model/timeout setting is added. The full provider-free suite passed 356 tests with one existing skip and zero failures, including ordinary notice zero-turn behavior, explicit wake, input cancellation, session replacement, stale context and exact reply binding. Format/render/status regressions additionally verify that intent and exact replies never invent task outcomes. These local results are not a platform CI or real-model execution claim. Candidate `0.17.1-fork.6`, immutable release, selected installation and modules loaded by existing sessions remain distinct; retain fork.5 for rollback and do not force reload active sessions.
