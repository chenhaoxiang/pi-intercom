# runtime-version-awareness Specification

## Purpose
TBD - created by archiving change runtime-version-advisories. Update Purpose after archive.
## Requirements
### Requirement: Report loaded Intercom versions honestly

The extension SHALL capture its own package version when its runtime is loaded and SHALL carry the validated optional version in registration and authored message metadata. Absence SHALL mean unknown, not stale. A changed disk selection SHALL NOT be reported as a loaded-runtime change.

#### Scenario: New sender through old broker

- **WHEN** a new sender connects through a broker that strips unknown registration fields
- **THEN** an authored message SHALL retain its additive runtime version metadata and an old receiver SHALL still receive unchanged message content

#### Scenario: Old sender

- **WHEN** a peer provides no version metadata
- **THEN** list/inbound views SHALL report unknown and SHALL NOT infer a version from peer name, PID, model or installation directory

### Requirement: Prefer convergence without interrupting work

The extension SHALL use existing local tool/message boundaries to display a bounded advisory when its loaded version is older than a validated local selection or a reported peer version. Advice SHALL instruct checking the selected version and preserving active work before reload/restart; it SHALL NOT perform installation, reload, restart, or another model/provider call.

#### Scenario: Busy session sees a newer peer

- **WHEN** a message from a newer reported Intercom runtime arrives while work is active
- **THEN** normal message delivery and wake policy SHALL remain authoritative and the advice SHALL NOT cause an extra turn or interrupt the task

#### Scenario: Repeated peer mismatch

- **WHEN** several messages from the same newer version arrive
- **THEN** the local runtime SHALL emit at most one advice for that version in its bounded advisory cache

#### Scenario: Untrusted metadata

- **WHEN** version data contains controls, is malformed, or uses an unsupported prerelease
- **THEN** it SHALL not be rendered as a trusted comparison or used to request an upgrade

