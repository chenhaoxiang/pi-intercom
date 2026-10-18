---
doc_type: bug
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-19
verified: 2026-10-19
verified_by: manual
---

# Consistent sender matching after ask recovery

Fork.4 independent follow-up review found that an exact `replyTo` could accept a sender ID prefix while its ask was in memory, but reject the same cross-check after durable recovery. Recovery also returned the stale “No pending ask” error for a genuine sender mismatch.

Fork.5 reuses one sender-matching predicate for both paths. Recovery first locates the exact pending message ID addressed to the current session, then validates the optional sender using the full ID, its prefix, or case-insensitive exact display name. The actual destination always remains the bound full sender ID. It never infers a pending ask from a prefix or name, changes its scope, or guesses an unbound duplicate name.

The integration regression restarts only its owned fixture broker/session, rejects an unrelated sender with `is not from`, then answers the recovered ask with a short-ID cross-check. The duplicate-name negative test now names a third-party session instead of the current session, so a separate self-send guard cannot mask a missing binding check. All test traffic is synthetic and provider-free.

Release `0.17.1-fork.5` must be published as new immutable assets; fork.4 remains available. Package installation changes disk/settings only, without restarting the shared broker or any existing Pi session.
