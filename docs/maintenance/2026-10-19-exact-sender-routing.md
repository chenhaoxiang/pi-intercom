---
doc_type: bug
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-19
verified: 2026-10-19
verified_by: manual
---

# Exact sender routing after duplicate-name messages

## Problem and fix

Several Pi sessions can legitimately share a fallback title. Ordinary inbound messages previously showed only that title and no exact reply command, so an agent could copy the display name into `send` and hit avoidable ambiguity. Also, `send` resolved a duplicate name before considering an explicit pending `replyTo`, even though that message already bound a unique sender.

Fork.4 adds an ordinary-message reply hint using the full sender session ID. Exact pending `replyTo` sends resolve the original sender first and validate an optional `to` against that binding; an unrelated target still fails. Without an explicit message binding, ambiguous names remain an error rather than silently selecting a peer. Duplicate-name compose labels use full IDs, not eight-character prefixes that may collide.

## Validation and scope

Provider-free integration regressions cover ordinary same-name status messages, exact-ID sends, explicit pending-reply routing and mismatched sender rejection. The full suite passed 354 tests with one live-Herdr test skipped. Fixtures use a short private project-specific OS tmp root; a longer path initially exceeded the Unix socket limit and was not treated as a product regression or passing run.

No broker protocol, wake policy, auto-retry or scope boundary changes are included. `wake:false` remains a context-only notification; delivery is not proof that work started. No user message is synthesized on Pi 1.3 custom turns, and no Hindsight/footer implementation is changed here.

## Delivery and activation

Source, PR/main, immutable release, fresh-download verification and installed package are distinct evidence levels. Version `0.17.1-fork.4` must use a fresh tag/artifact and leave fork.3 intact. Installation must update only the intercom package selection; never restart the shared broker or existing Pi sessions. Already loaded extensions remain on their old code until the operator chooses their normal lifecycle transition.
