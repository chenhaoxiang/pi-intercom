# Proposal

## Why

Long-lived Pi sessions often keep old extension code after disk packages are upgraded. Prefer convergence to the current installation, but make loaded versions observable without interrupting work or mistaking transport delivery for upgrade completion.

## What Changes

- Add optional reported Intercom runtime version to registration and messages; old senders remain unknown and old brokers remain usable.
- Show runtime versions in the existing list/status/inbound views. Reuse delivered messages for bounded local upgrade advice when a newer peer is actually observed.
- Report a locally selected newer version at an existing tool/command boundary, without a timer, network check, new model turn, package installation or reload.
- Preserve existing message text, IDs, reply/wake semantics and old-broker compatibility. Version reports are advisory metadata, never authority or a capability guarantee.

## Capabilities

### New Capabilities

- `runtime-version-awareness`: Report loaded Intercom versions and safe event-driven upgrade advice.

### Modified Capabilities

None.

## Impact

`types.ts`, broker/client/protocol registration and send paths, the existing list/status/inbound formatter, a small runtime-version helper, provider-free tests and bilingual guidance. No new runtime dependency, remote upgrade action, autonomous execution path or broker restart mechanism.
