# Project guidance

This is the maintained fork of nicobailon/pi-intercom. Use an isolated worktree; preserve unrelated dirty work and existing repair ancestry.

- `main` is our integration/release branch; changes enter through PRs and regular merges.
- `upstream-main` is an exact community main mirror without fork commits. Restrict the read-only `upstream` remote to main. Never install the mirror.
- Versions use `<community-version>-fork.<revision>` and each validated version gets a stable GitHub Release with an installable tarball, provenance and SHA-256 checksums. Do not publish under the upstream npm identity.
- Run the full provider-free `npm test` suite before release. Keep synthetic fixtures under a short project-specific tmp directory outside any Git tree/node_modules ancestor; macOS socket length and discovery assertions depend on that isolation. Preserve existing tests; community expectation changes must be tied to the corresponding upstream fix.
- Do not read private coordination history, send real model prompts, kill the shared live broker, or terminate unrelated Pi sessions during verification/installation. Installation on disk is distinct from runtime hot reload.

## Documentation map

- `README.md` / `README.zh-CN.md`: English-first/Chinese installation, operations, configuration and privacy boundaries.
- `docs/releasing.md`: branch/version contract, repair preservation, per-version releases, asset verification and restart limitations.
- `CHANGELOG.md`: community and maintained-fork release history.
