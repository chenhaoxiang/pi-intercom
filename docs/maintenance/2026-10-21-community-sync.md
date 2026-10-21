---
doc_type: report
project: workspace
component: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-21
verified: 2026-10-21
verified_by: manual
owner: chx
---

# 0.18.0-fork.1 community integration

## Exact scope

Integrate 7 community commits through `684784cedcff4630e18d77c4e43ce0a691ad67fb` (source version 0.18.0) into the maintained `main`; preserve previous release 0.17.1-fork.7 for rollback. Pure `upstream-main` remains a separate exact mirror. This document records source validation, not a pre-emptive release or installed-runtime claim.

Integrates virtual-model handover through streamSimple, unique-name-prefix diagnostics, queued/expired receipts, mailbox-aware broker lifetime, npm 12 pack output and per-message fullscreen expansion. Semantic conflict resolution retains exact replyTo sender binding before name fallback, wakeProtocol/explicit wake intent, quiet modern status, legacy unmarked task wakes, never policy, native custom turns, durable asks and actionable relay wake. Both expansion and attention labels remain visible; all fork and upstream regressions are retained.

## Verification

Full provider-free `npm test`: 384 passed, 1 skipped, 0 failed using a short external synthetic root. This repository has no tracked CI workflow or required status context; local full-suite evidence and independent review are the applicable gates. No private coordination history was read, no live broker was killed and no real model was prompted.

Independent review and exact-head CI are bound to the synchronization PR. Release assets must be built from the exact remote merge commit, include a source manifest and SHA-256 checksums, then be freshly downloaded and verified before installation. GitHub Release notes record those later outcomes; do not infer them from this source report.

## Installation boundary

The authorized rollout selects a new permanent versioned package directory only after artifact and provider-free host-loading checks. Preserve old packages and a settings backup; do not force-restart loaded parents, children or a shared broker. Disk selection does not prove existing sessions loaded the new code. Real credentials, paid queries/probes, provider settings and unrelated package declarations are not part of verification.
