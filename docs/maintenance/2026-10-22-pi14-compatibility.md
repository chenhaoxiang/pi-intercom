---
doc_type: report
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-22
updated: 2026-10-22
owner: chx
---

# Native-turn boundary and Pi 1.4 upgrade

Prepare `0.18.0-fork.3` from maintained main `5e06773`, integrating the sole new community commit `8f0750b` after community 0.18.0. Community confirmed that native custom turns run the prompt lifecycle starting at Pi 1.2, not 1.3. Use the existing strict stable/fork host predicate with the corrected 1.2 boundary, and an injectable host version for deterministic tests; arbitrary prereleases and unknown hosts remain on the legacy path.

Retain the fork's actionable/ordinary message policy, explicit `wake:false` precedence, `never` receiver policy, native custom provenance, cross-extension idle reservation/release, human-first ordering, exact reply binding, broker compatibility and bounded runtime-version advice. Do not replace these with community's simpler wake path. The upstream generic tests that forced 1.1 are kept on the actual maintained SDK because their fork assertions explicitly require native wakes. A separate 1.1 regression verifies the preserved legacy user wake and silent ordinary notice. A new 1.2 regression exercises the upstream native-turn fix. No existing fork assertion is weakened.

## Verification

The corrected isolated Node 22 full provider-free suite passed: **399 passed, 1 skipped, 0 failed**. Synthetic HOME/TMPDIR are outside Git and user configuration ancestry. The first attempt wrongly fixed PI_CODING_AGENT_DIR across tests that intentionally replace HOME; it also adopted upstream legacy-version arguments into fork-native assertions. Those setup/merge issues were corrected, not hidden by weakening expected results. Dependency audit is zero findings. Tests do not use private coordination history, real provider prompts or the shared live broker.

Development retains the immutable Pi 1.3 SDK lower baseline and host-provided runtime peers. The complete configured package set loads under the newly built Pi 1.4.0-fork.1 with zero extension errors/warnings. On that exact SDK, a separate fixture runs 183 integration/native-session/idle-boundary tests, all passing with no skips or provider requests. This does not claim manual TUI or production-broker acceptance. Exact-head independent review, PR merge, immutable Release, fresh checksum download and side-by-side local installation remain separate evidence layers. Preserve the previous 0.18.0-fork.2 installation and do not restart unrelated sessions or the shared broker.

## Released and installed acceptance

[PR #21](https://github.com/chenhaoxiang/pi-intercom/pull/21) merged normally as `a2d16ce61a419db2a092bd71d6e40355d6192a42`; independent review at `7cde7d8333166d9e04a88541ee2ee76e515dd808` found no blocker/major. This repository has no tracked CI producer; local complete provider-free tests, review and artifact verification remain the applicable gates rather than invented CI checks.

The immutable [v0.18.0-fork.3 Release](https://github.com/chenhaoxiang/pi-intercom/releases/tag/v0.18.0-fork.3) targets that source. Its package/manifest checksums passed after a fresh download. All 52 package files in the permanent versioned installation match the tarball. The unchanged tsx 4.23.15 production dependency closure was copied byte-for-byte from the retained fork.2 install after an offline npm attempt could not resolve the unchanged development SDK; no new dependency resolution or false successful install is claimed.

Pi 1.4.0-fork.1 loads the installed package without errors/warnings; isolated installed RPC returns state/commands, exit 0, no stderr and no model request. Settings selects only the new versioned directory; fork.2 and rollback selections remain. The previous live broker and active sessions were not restarted or reloaded, so their loaded version can remain old. Manual TUI and live-peer delivery are not claimed by these synthetic checks.

The earlier lifecycle-disabled npm install reported zero findings; a redundant raw audit refresh later timed out and is not counted as a clean audit. Released community 0.18.0 plus follow-up 8f0750b are distinct provenance inputs.
