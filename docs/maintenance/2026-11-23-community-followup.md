---
doc_type: report
project: workspace
component: pi-intercom
status: active
truth_mode: maintained
created: 2026-11-23
verified: 2026-11-23
verified_by: manual
owner: chx
---

# 0.18.1-fork.12 community follow-up

## Scope

This candidate is based on maintained `origin/main` `c5bb40b92c1c760e5e50a57a1c1dd90d8edf3a43` and selectively integrates four low-risk community fixes from upstream `nicobailon/pi-intercom`:

- retain local Unix socket/named-pipe sessions during heartbeat starvation;
- route a message addressed to a disconnected exact session ID without falling through to a live look-alike;
- probe the broker endpoint when `broker.pid` names an unseen process;
- ignore late lifecycle events from disposed/replaced sessions.

The upstream tip contains 14 commits / 73 files and also removes or rewrites fork-owned durable ask/reply, scope, wake, runtime-version, follow-up and receipt contracts. Those changes are intentionally excluded. The candidate does not replace the fork README/docs with upstream product text.

## Validation

- `npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps --allow-remote=all` — passed.
- `TMPDIR=/tmp/pi-intercom-followup-20261123 npm test` — **505 passed, 11 skipped, 0 failed**.
- Synthetic/provider-free fixtures only; no shared live broker was killed and no unrelated session was terminated.

## Delivery boundary

Candidate source commit: `0469840` (topic branch `sync/community-followup-20261123`). No merge, Release, installation or broker reload has been performed. Existing `0.18.1-fork.11` remains the rollback/install baseline. If this candidate proceeds, use the regular PR, exact-head review, immutable `v0.18.1-fork.12` Release, fresh asset download/checksum verification and side-by-side installation; do not install `upstream-main`.
