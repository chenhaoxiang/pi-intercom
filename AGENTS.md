# Project guidance

This is the maintained fork of nicobailon/pi-intercom. Use an isolated worktree; preserve unrelated dirty work and existing repair ancestry.

- `main` is our integration/release branch; changes enter through PRs and regular merges.
- `upstream-main` is an exact community main mirror without fork commits. Restrict the read-only `upstream` remote to main. Never install the mirror.
- Versions use `<community-version>-fork.<revision>` and each validated version gets a stable GitHub Release with an installable tarball, provenance and SHA-256 checksums. Do not publish under the upstream npm identity.
- Run the full provider-free `npm test` suite before release. Keep synthetic fixtures under a short project-specific tmp directory outside any Git tree/node_modules ancestor; macOS socket length and discovery assertions depend on that isolation. Preserve existing tests; community expectation changes must be tied to the corresponding upstream fix.
- Do not read private coordination history, send real model prompts, kill the shared live broker, or terminate unrelated Pi sessions during verification/installation. Installation on disk is distinct from runtime hot reload.

## Documentation map

- `docs/maintenance/2026-10-19-exact-sender-routing.md`: exact sender hints, message-bound duplicate-name replies, provider-free regressions and fork.4 activation boundaries.

- `docs/maintenance/2026-10-18-legacy-wake-compatibility.md`: legacy unmarked send compatibility, modern explicit attention semantics, mixed-version validation, immutable fork.3 release/installed acceptance and activation boundaries.

- `docs/maintenance/2026-10-18-inbound-wake-convergence.md`: ordinary peer status is context-only, explicit asks/replies and wake requests remain actionable; native custom turns preserve source on Pi 1.3+.

- `docs/maintenance/2026-10-17-community-0.17.1.md`: exact community integration, explicit ordinary reply versus pending ask semantics, queue bounds, validation and release/install boundaries.

- `docs/maintenance/2026-10-11-installed-acceptance.md`: v0.17.0-fork.1 immutable release download, installed byte readback, RPC smoke and restart boundary.
- `README.md` / `README.zh-CN.md`: English-first/Chinese installation, operations, configuration and privacy boundaries.
- `docs/releasing.md`: branch/version contract, repair preservation, per-version releases, asset verification and restart limitations.
- `CHANGELOG.md`: community and maintained-fork release history.
