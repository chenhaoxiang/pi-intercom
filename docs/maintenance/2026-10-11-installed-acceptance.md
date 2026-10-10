---
doc_type: report
project: pi-intercom
status: completed
truth_mode: snapshot
created: 2026-10-11
verified: 2026-10-11
verified_by: source-release-install-readback
owner: chx
ssot: false
---

# 0.17.0-fork.1 installed acceptance

## Release and installation

- Release: [v0.17.0-fork.1](https://github.com/chenhaoxiang/pi-intercom/releases/tag/v0.17.0-fork.1).
- Exact source: merge commit `5eb33fd1182f1bc55ce6761df538c4a9b51b68ee`.
- Community mirror: `upstream-main` at `14731a4873b500e19d000bf131142e430e4b7928`.
- Tarball SHA-256: `e83bcfbfdcb60a61d2ef1f8bbbab101e30acbee254fa6959ffa7c4221a84064a`.
- The published tarball, `release-manifest.json`, and `SHA256SUMS` were downloaded afresh and verified before installation.
- The permanent local package directory is versioned as `~/.pi/agent/packages/pi-intercom/0.17.0-fork.1`; settings select `packages/pi-intercom/0.17.0-fork.1`.
- The previous Git checkout and release remain available for rollback; no active broker or Pi session was stopped.

## Installed readback

Every one of the 42 files in the downloaded release tarball was compared byte-for-byte with the permanent installed directory. All files matched. A provider-free RPC smoke loaded the installed package and exposed the expected `intercom`, `intercom-pool`, `handover`, and `skill:pi-intercom` commands; provider requests were 0.

The local maintenance page subsequently reported `0.17.0-fork.1`, release manifest source `5eb33fd11`, and the fork's mirror synchronized with the community main. Disk installation does not imply that already-running Pi processes have hot-reloaded the package; restart only after active work is settled.
