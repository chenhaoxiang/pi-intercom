---
doc_type: report
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-21
owner: chx
---

# Runtime versions and safe convergence — 0.18.0-fork.2

## Intent

Prefer unifying cooperating sessions on the reviewed current package, while accepting that long-running old sessions continue during transition. Disk installation, delivery receipts and a peer's claim never prove a runtime changed. State-format safety is handled separately by the Service Tier owner; message advice cannot replace that protection.

## Behavior

The extension captures its own package version at module load. A validated optional `intercomVersion` is carried by registration, roster and authored messages; source message text, IDs, reply binding, authored wake and routing authority remain unchanged. Older brokers may omit registration metadata but preserve the existing message spread, so missing versions remain explicitly unknown. Version reports are self-reported metadata, not an attestation or capability contract. The broker additionally reports its own loaded version during registration; `status` distinguishes that separate process from the client extension. Old brokers report unknown and are not silently restarted.

Only existing local tool/message boundaries produce advice. A newer local selected package or newer peer-reported version can append a non-triggering custom notice once per observed version in a bounded sixteen-entry cache. Sender tool output can similarly advise one ordinary authorized message to an older/unknown peer AI; unknown is not classified as outdated. No message is automatically sent, no new model turn is requested, and no package installation/reload/restart command is executed. The original task and active children keep priority.

A truly old client lacks this code: it does not magically acquire advice handling. Initial convergence therefore still uses a deliberate ordinary peer message or operator reload/restart at a safe idle point. Existing core/module reload guards remain authoritative. This feature reports only Intercom versions and does not fabricate loaded versions for the core or other extensions.

## Existing primitive and non-goals

Reuse Intercom list/status, message metadata, custom display notices and the existing Pi reload/restart lifecycle. Do not introduce a remote execution action, background updater, version polling service, approval ledger, forced child/broker restart or automatic update loop. A healthy old broker can remain live until a coordinated idle window; its 0.18 mailbox fix is not claimed active simply because this package is installed.

## Validation boundary

The existing full provider-free suite, new helper/protocol/integration checks and package verification remain gates. Additional synthetic mixed-broker smoke uses the actual retained 0.17.1-fork.5 and 0.18.0-fork.1 brokers plus the retained old receiver: message metadata survives, authored text/wake stays unchanged, and absent roster versions remain unknown. These fixtures own only their own temporary brokers and never stop the live shared broker.

Exact head review, final counts, publication, fresh downloads and local selection are separate PR/Release/owner-local receipt evidence. No real model/provider call, private history read, live broker termination or existing-session reload is part of these tests.
