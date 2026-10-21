---
doc_type: runbook
project: pi-intercom
status: active
truth_mode: maintained
created: 2026-10-21
verified: 2026-10-21
verification_scope: pinned SDK source, provider-free local validation and explicit delivery boundaries
owner: chx
---

# Pi 1.3 development SDK baseline

Development uses verified immutable `v1.3.0-fork.1` SDK assets from `chenhaoxiang/pi` instead of floating `*` SDK dependencies. TypeBox is pinned to the host's `1.3.27`; Pi transitive peers use exact release overrides. The existing npm lockfile is now visibly tracked rather than ignored, and `npm ci --ignore-scripts` reproduces the development tree. Runtime Pi packages remain host-provided peers; neither broker nor extension bundles another Pi.

Existing wake tests had legacy user-prompt expectations that no longer match the loaded Pi 1.3 SDK. They now count native `triggerTurn: true` custom turns and independently reject fabricated user messages. Assertions still cover context-only status, explicit asks/wakes, never policy, busy steering, shared wake reservation/rearming/expiry and exact sender/reply binding. Production routing, broker state and delivery behavior are unchanged.

`test/sdk-baseline.test.mjs` checks declared, locked and installed SDK identity plus integrity and dev-only placement. Run the full provider-free `npm test` with a synthetic HOME and short external TMPDIR. Do not export a shared PI_CODING_AGENT_DIR over fixture-local HOME: integration fixtures own their pending-ask state, and the native session tests create their own agent directories. The real AgentSession/faux-provider tests exercise ordering and native custom-turn delivery without real model calls.

There is still no tracked CI workflow or typecheck entry in this repository; report those as not configured, not passing. The associated PR carries exact local results and independent review. No release, installation, shared broker restart or active-session reload is included; old installations and immutable releases remain unchanged.
