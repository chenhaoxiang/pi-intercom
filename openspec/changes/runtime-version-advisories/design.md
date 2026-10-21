# Design

## Boundaries

Use optional `intercomVersion` fields on existing registration/session/message objects. The extension captures its own manifest version at module load and stamps registrations; `IntercomClient` preserves that captured value when authoring a message. This survives the legacy broker's existing spread-forwarding while registration data may be omitted by that broker. No protocol version bump is required, and absent metadata stays unknown.

Version data is self-reported advisory metadata. Only bounded stable or `-fork.N` version syntax is displayed/compared. It is not auth, capability negotiation, loaded-code attestation or authorization to update another process.

## Existing boundaries, not another runner

List/status and inbound metadata show reported loaded versions. At an existing tool invocation, a small read-only helper examines the selected local Intercom package manifest; it does not reconcile packages or query a remote registry. A mismatch produces one local, non-triggering custom notice per version, bounded to sixteen cache entries. Existing inbound messages can produce the same advice when their reported runtime is newer. Ordinary status messages stay context-only, and receiver policy/dedupe/human priority remain authoritative.

The sender can receive a one-time result hint to ask an older or unknown peer AI to check its own version through one ordinary authorized message. This does not rewrite the authored message, send another message, wake a receiver, or grant that peer new authority. The old original clients cannot be retroactively endowed with this feature; initial rollout still requires an explicit ordinary notice or operator reload/restart. Updating disk alone never claims the old runtime changed.

## Non-goals

No remote execution/reload action, no forced restart of busy sessions or the shared broker, no background version polling, no package downloads, no new model calls, no generic cross-package upgrade framework, and no fabricated runtime versions for unrelated extensions. Other packages require their own reported evidence.

## Validation

Provider-free helper/protocol tests, normal broker integration, runtime metadata preservation, unchanged authored content/wake, bounded newer-peer advice with zero extra turns, plus local synthetic mixed-broker smoke using the retained old package. Full existing `npm test` and package dry-run remain required; publication and installed activation are separate evidence.
