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

## Replacing an ask without reviving its reply edge (fork.7 broker)

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

Cancellation already removes the old broker reply edge and retained pending ask. Fork.7 makes an accepted same-sender/same-receiver `supersedes` do the same, without marking the old question answered or deleting its delivered content. Previously the receiver dismissed the ask locally, but the broker retained its edge/file: `pending` could resurrect it, restart could rehydrate it, and an old reply still appeared to answer an open request. Rejected replacements do not retire anything. A replacement may be an ordinary `send`; it need not create another ask.

This is a transport relation only: `supersedes` says that this exact new message ID replaces that exact old message ID for this exact sender/receiver route. It is not a business replacement, scope change, authorization renewal or owner result. `cancel` is likewise an explicit transport withdrawal, not proof that already-injected work was revoked or rolled back. Neither action infers an applicable business version from question-owner `workRef`, `stage`, `epoch` or `seq`; no same-work metadata or larger observation sequence can synthesize either relation. The broker's existing transport endpoint checks are separate from these owner observations. Closing, declining or aborting the content-free native question UI is not an Intercom `cancel` or a business revoke.

While the broker still retains the original ask's exact delivery route, an already-authored late reply from its original peer is delivered with `lateReplyTo: old-ask-id`, no `replyTo`, and a `demoted: "late_reply"` receipt. It cannot resolve a newer waiter, mark either request answered, or cancel the newer request's follow-up. The original request/reply reference is preserved for the work owner; whether that answer is applicable, stale, superseded in business terms or still pending is not decided by Intercom. A repeated identical reply message ID reuses the delivery receipt rather than injecting another copy or emitting another follow-up observation. This is bounded transport deduplication, not business exactly-once execution. Ordinary wake policy still applies: an explicitly requested wake remains explicit; a quiet demoted reply does not gain reply-driven wake authority.

The public `reply` tool must still resolve an inbound pending ask. Once a receiver processes a cancellation/supersede control, that old `replyTo` is rejected before sending; do not remove it and retarget the answer to a newer question. The demotion path covers a response already authored/in flight or a sender whose local waiter was cancelled without a receiver control. It is not an answer-adoption API. Broker restart/route expiry can remove late-reply provenance; `E_REPLY_TARGET` and the existing one-ordinary-response fallback remain `UNKNOWN`, not proof of renewed relevance. Only still-pending exact asks are recovered durably.

An unrevoked answer arriving after the local wait timed out keeps its original `replyTo`, not the newer ask's ID. The existing follow-up seam cancels that original binding once; the newer wait and binding remain active. A partial answer or ACK can close this transport reply-wait, but the text stays unchanged and `status` keeps `execution`/`completion: "unknown"`. No transport code parses it as full approval: required sub-items, covered/uncovered references and applicability are owner data. Fresh-owner adoption also remains an owner fact requiring an exact original-question → new-owner relation and usable route; handoff delivery alone is not proof of adoption or success. Remaining questions, partial applicability, fresh-owner adoption and any next phase belong to the work owner.

Fork.7 alone does **not** retire an older scheduled follow-up on `cancel`/`supersedes`. Its broker-focused tests substitute the process-local schedule responder and prove broker/client/tool, pending-record, restart, duplicate-reply and partial-response behavior, not Schedule storage/timers. The extension composition below closes that separate gap without changing the broker protocol or introducing a question database.

Desk/rpiv consumption remains the existing content-free native question contract. The `ask_user_question` `opened`/`answer-received`/`closed` and optional declared work association are observations only; they do not create a replace/revoke/late/partial/fresh-owner public contract. In particular, UI close, `declined`, and `aborted` are not business revoke facts; Intercom does not consume `workRef`, `stage`, `epoch` or `seq` to infer one. This candidate therefore adds no field for an applicable version or answer coverage. The owner must supply those facts if a later owner contract needs them.

The broker fix activates only in a broker loading this candidate. It is not retroactive to a healthy older shared broker, and extension reload is not broker activation. On such a broker, explicit `cancel` followed by a new request uses the already-working withdrawal path; preserve `UNKNOWN` for unsupported status queries. Cross-machine lifecycle actions, historical forks, live UI/notification delivery and business answer consumption are outside this evidence. The content-free `ask_user_question` opened/answer-received/closed observation remains independent: closing its UI is not an Intercom cancellation, authorization or completion signal.

## Retiring the old follow-up (fork.8 source candidate)

Only a confirmed broker acceptance of explicit `cancel`, or a `send`/`ask` with `supersedes` to the same exact peer, starts retirement. It selects the existing local `PendingFollowup` by the old `messageId`, owner session, Intercom session, peer and runtime generation. Rejected/wrong-target operations, uncertain delivery, ordinary messages and an ask timeout do not trigger Schedule calls. An accepted action without an exact local binding reports unchecked/unknown instead of scanning old history or guessing a peer/timer.

The existing `cancelled` marker is set before awaiting an in-flight create, and one `cancelPromise` is shared with the exact-reply path. After create settles, Intercom uses the unchanged `schedule:reply-followup:v1` `cancel`, then `get` to read the actual stored state. Retirement is confirmed only when the readback succeeds and explicitly reports `enabled: false`, `pending: false`, and a state other than `pending`; a cancel acknowledgement alone is insufficient. Otherwise `ok: false` and a not-confirmed reason accompany the unchanged readback state/flags and `completion: "unknown"`. A disabled dispatched-UNKNOWN result remains UNKNOWN, not business completion.

Only that confirmed inactive readback allows the existing 60-second local record cleanup. An unconfirmed retirement retains its in-memory `cancelled` marker, so a later due callback cannot revive transport after the old cleanup window. There is no additional retry, polling, timer store or expiry framework; reload can discard this local marker and is not a durable cancellation guarantee.

A racing due callback rechecks the local retirement marker and runtime before sending. A valid due request belonging to a foreign/stale owner or Intercom session receives an explicit undelivered/unknown response through its original callback, without querying/sending transport or adopting that owner. The original Schedule claim can therefore settle UNKNOWN immediately rather than remaining dispatched until its deadline. Same-owner session replacement is still a new runtime; an old binding is not implicitly adopted. Exact reply observations and inbound deduplication remain intact.

Main transport and timer results are separate:

```ts
// Additive result details; not a new input or event schema.
{
  delivered: true,
  followUpRetirement: {
    messageId: "old-ask-id",
    result: { ok: true, state: "cancelled", enabled: false, pending: false, completion: "unknown" },
  },
}
```

A superseding send starts retirement immediately after broker acceptance, but records its sent-history entry and dismisses any answered inbound ask before awaiting optional retirement readback. The tool result may still await that bounded metadata; the already-accepted transport fact is not delayed. A replacement ask likewise starts retiring the old timer immediately after send acceptance, before awaiting its answer. Its own `followUp` result belongs only to the new binding; timeout/cancellation/error results retain the old `followUpRetirement` separately. Missing support, component throw/timeout, store contention or failed readback cannot turn an accepted main message into `NOT_SENT` or justify a blind retry. The existing 10-second bound applies to each Schedule request, including create when in flight; a retirement may therefore await create, cancel and get in sequence. A timed-out component may still act later, so unknown readback is not proof of absence or quiescence.

A stored pending timer can be disabled and unscheduled. If dispatch has begun, Schedule retains `unknown`, including after restart: retirement does not retract an already-injected reminder, cancel already-executed business work, or authorize replay. No ledger, timer database, polling loop, second executor, new tool parameter or Schedule event field is introduced.

### Source validation and reproduction

The minimum red check first added the public-tool cancel/send-supersede/ask-supersede cases against the unmodified implementation: all three failed waiting for old-binding cancel/get. Green validation includes wrong peer/id/sender/owner/runtime, unconfirmed transport, missing/throwing/timed-out Schedule, in-flight create and reply/cancel deduplication, session switches and independent replacement timers. Existing fork.7 late-reply/partial-answer cases are retained.

The optional **fixed Schedule retirement** cases in `intercom.integration.test.ts` run actual `src/index.ts` event wiring, `CronStorage` and `CronScheduler` from Schedule commit **`1db6896d744b0f2df6dd0adce84bf96553f82029`**. They verify all production `src/**/*.ts` plus package/lock bytes with SHA-256 **`e2072cb18b75287e871853c3a6b1aacde6aa9038834d272cafa2cfdb92b18863`** (sorted relative filename, NUL, file bytes). No substitute Schedule responder is used in these cases. A separate store instance checks persisted state; live scheduler next-run/pending readbacks and crossing the old deadline establish unscheduling, not just a returned acknowledgement. Real queued/during-dispatch/after-send barriers, store lock failure, a controlled synthetic clock, exact foreign bindings and restart check the UNKNOWN/no-replay boundary.

Reproduce in an owned worktree `tmp/` archive, never in the canonical Schedule checkout or a live store:

```bash
git -C "$READ_ONLY_SCHEDULE_REPO" archive 1db6896d744b0f2df6dd0adce84bf96553f82029 | tar -x -C tmp/schedule-source
# Under env -i with synthetic HOME, a short external TMPDIR, owned npm cache,
# empty owned npm configs and Node 22 PATH (optional proxy allowlist only for downloads):
npm ci --ignore-scripts
npm --prefix tmp/schedule-source ci --ignore-scripts
PI_INTERCOM_SCHEDULE_SOURCE="$PWD/tmp/schedule-source" npm test
```

The initial isolated Node 22 full provider-free run with this archive passed **481 tests, 0 failed, 1 existing live-Herdr skip** (482 total); all eight original fixed-source cases ran. The initial minimum red was 0/3 passed. The review-boundary regressions then reproduced all four observations before the correction: unconfirmed readback reported success, a failed cancellation's marker disappeared after 60 seconds, foreign/stale due claims remained dispatched, and sent-history recording waited for optional retirement. The nine-case boundary red was 0 passed/9 failed; the focused corrected run including real components and retained late-reply regressions passed 20/20. The store-lock regression now advances a synthetic clock beyond 60 seconds and the old due time, verifies no transport query/send, and reads back the original claim settled UNKNOWN while the new timer remains unchanged. Two additional real-component cases verify foreign/stale owner callbacks settle only their original claim. A positive clock regression retains the original bounded cleanup for confirmed inactive readback. The final boundary-corrected full run passed **490 tests, 0 failed, 1 existing live-Herdr skip** (491 total), with all ten fixed-source cases executed; the baseline red and the boundary red remain separate evidence.

The original locked installs reported 3 Intercom development/test dependency findings (2 moderate, 1 high) and 9 Schedule fixture dependency findings (4 moderate, 5 high). A separate parent-run Intercom production-only audit reported zero vulnerabilities. Dependencies were not upgraded or audited again in this boundary correction.

Without the explicit archive path, the ten fixed-source cases skip; a normal provider-free `npm test` alone must not be reported as real Schedule verification. Fixture stores, brokers, sessions and clocks are synthetic. No real provider calls, live peer prompts, private coordination history, shared broker restart or active reload are used. Candidate checks do not establish release, installation, all-host compatibility, live business acceptance or rollback of injected work. Schedule production and Desk public/native schema are unchanged.

## Parameter correction contract (fork.4)

The existing single `intercom` tool requests provider-preferred strict JSON Schema sampling. On supported hosts, optional JSON null values are restored to omission before execution; placeholder strings such as `unused`, `:omit`, `undefined` and `null` are not omission. The tool validates action-specific fields, required target/message values and routing IDs before connecting. Parameter failures return model-visible JSON with `E_INTERCOM_INVALID_PARAMETERS`, `field`, `reason`, `corrections`, `state: "NOT_SENT"` and `retryPolicy: "CORRECT_ARGUMENTS_ONCE"`. The correction is advice, not an automatic resend or permission to change the intended recipient/action. The result does not echo the business message body.

A reply ID that cannot be resolved is also rejected with correction JSON before a send attempt; it is never silently removed to turn the response into a notification. Existing valid exact-sender reply fallback and all post-allocation `UNKNOWN` outcomes remain unchanged. Provider-free tests exercise the SDK Responses adapter, host argument normalization, the public tool and synthetic broker, but do not prove every remote provider accepts the schema.

## Follow-up runtime/context hardening (local candidate)

The Intercom tool now performs an action-specific preflight before connecting, then constructs a minimal action-specific argument object for direct tool/codemode execution. Nullable optional fields and empty attachment arrays are omitted; non-null unsupported fields, placeholder IDs and missing required routing/message fields remain fail-closed with `NOT_SENT` correction JSON. The requested action, target, message, wake bit and real routing IDs are not rewritten.

Runtime-version upgrade advice now uses the UI-only maintenance notification path rather than appending a model-context message. No request-local projection of existing messages is performed: ordinary notices, attachments, replies, raw history, cached prefixes and opaque checkpoint replay remain unchanged. `intercom status` now reports selected/loaded runtime and local idle/queue/held-message/pending-ask facts; it does not certify child settlement or authorize an automatic reload.

This source change does not install packages, reload active sessions, or prove live business delivery. Provider-free tests and isolated synthetic sessions are the source validation boundary; installation, runtime loading and live acceptance are separate evidence.
