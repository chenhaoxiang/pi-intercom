# Pi Intercom

English | [中文](README.zh-CN.md)

Direct 1:1 messaging between Pi sessions on the same machine. This repository is the maintained `chenhaoxiang/pi-intercom` fork of the upstream intercom extension.

> Fork repository: <https://github.com/chenhaoxiang/pi-intercom>
>
> Use **pi-intercom** for one-to-one conversations. Use [pi-messenger](https://github.com/chenhaoxiang/pi-messenger) for shared presence, reservations, and Crew workflows.

## Releases and branch policy

This maintained source prepares **0.18.0-fork.3** (published rollback baseline **0.18.0-fork.2**), based on community **0.18.0**; verify the matching immutable Release before installation. Fork releases use `<community-version>-fork.<revision>`; the fork revision increases without pretending to be a new upstream release.

- `main`: our maintained integration and release branch, including fork fixes.
- `upstream-main`: an exact mirror of the community's `main`, with no fork commits. Never install from this branch.
- Changes enter `main` through reviewed pull requests; existing branches and history are retained.

Install a reproducible release:

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@v0.18.0-fork.3
```

[GitHub Releases](https://github.com/chenhaoxiang/pi-intercom/releases) include the installable package tarball, a provenance manifest, and `SHA256SUMS`. These GitHub releases are not npm publications under the upstream author's namespace. See [release maintenance](docs/releasing.md) for asset installation and future releases.

## Install this fork

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@main
```

Restart Pi or run `/reload` after installation. Pin a reviewed commit when reproducibility matters:

```bash
pi install git:github.com/chenhaoxiang/pi-intercom@<reviewed-commit>
```

The extension auto-starts or reconnects to a small local broker when the first enabled session connects. There is no remote service and no network listener in the normal macOS/Linux path.

## Quick start

Name the current session so peers can address it reliably:

```text
/alias planner
```

Open the picker with **Alt+M** or `/intercom`, or use the tool directly:

```ts
intercom({ action: "list" })
intercom({ action: "send", to: "worker", message: "Please check the parser edge cases.", wake: true })
intercom({ action: "ask", to: "planner", message: "Which compatibility behavior should I preserve?" })
intercom({ action: "reply", replyTo: "message-id", message: "Use the existing behavior; add a regression test." })
intercom({ action: "status" })
```

`send` is fire-and-forget. `ask` requires a currently connected target and waits for a reply, returning that reply as the tool result. A disconnected target fails immediately instead of leaving a blocking request queued.

For a handoff, use the overlay's `h` key or:

```ts
intercom({ action: "handover", to: "worker", message: "Continue from the current plan and verify the remaining tests." })
```

## Runtime versions and safe convergence

`list` / `list-cwd` show self-reported loaded Intercom versions; `status` distinguishes this extension from the separate broker runtime. Old clients/brokers may report no version: that is **unknown**, not proof they are current or old. Authored messages carry additive version metadata without changing their text or wake intent, including through retained legacy brokers.

At an existing tool invocation or inbound message, a newer selected/peer-reported version can produce one bounded local advice, never another model turn. The sender may also receive a one-time hint to ask an older/unknown peer AI to check its runtime through one ordinary authorized message. Prefer the reviewed current installation, but preserve active work/children and arrange reload/restart only at a safe idle point. Reports are advisory, not update authority or proof of hot loading. No automatic install/reload, background version polling or broker termination is added. Other packages need their own version evidence.

A healthy legacy shared broker is deliberately reused; new source on disk does not activate its mailbox-lifetime fix. A coordinated idle restart remains a separate operation, not something a peer message may force.

## What the fork maintains

In fullscreen mode, a plain left-click anywhere on an intercom message expands or collapses just that message; click again to undo. Only the display changes, not the message content, what the model sees, or session history. Dragging to select text, clicking links, wheel scrolling, and double- or triple-click word and line selection keep working and do not toggle the message, though the first click of a rapid double-click can. Regular mode leaves mouse input to the terminal.

Ctrl+O still expands or collapses every message and clears per-message choices. Those choices are not saved: reloading, resuming, or forking a session, or anything that rebuilds the whole transcript, returns each message to the Ctrl+O state.


The fork keeps the original intercom UX and adds reliability boundaries needed for long-running local Pi sessions:

- community 0.18.0 adds virtual-model handovers, unique-name-prefix diagnostics, accurate queued/expired receipts and mailbox-aware broker lifetime;
- retained community 0.17.1 fixes: Windows state persistence, bounded stalled-peer queues and ask-preferred bare replies, retaining 0.17.0 pool isolation, receiver-confirmed delivery and reconnect behavior;
- durable `ask` / `reply` routing across broker restarts and Pi reloads; if a sender loses the original delivery receipt, a same-ID replay remains an unconfirmed outcome and a retry must use a new message ID;
- explicit message IDs, sender sequences, timestamps, delivery states, and reply hints;
- bounded duplicate delivery: a message is injected at most once per receiving session;
- explicit cancellation and same-sender supersede operations instead of unsafe automatic retries;
- optional routing scopes with `PI_INTERCOM_SCOPE_ID`, so scoped and unscoped sessions cannot cross the boundary;
- restart-stable addressing with `stableId` or `PI_INTERCOM_STABLE_ID`; since 0.17.0, each live session needs a distinct stable ID—if older config shared one `stableId`, set a per-session `PI_INTERCOM_STABLE_ID` and close all Pi sessions once after upgrading;
- liveness heartbeats and automatic reconnect when a broker disappears;
- `busyDelivery: "steer"` or `"human-first"` for choosing how peer messages enter a busy interactive session;
- a Pi-subagents bridge that exposes `contact_supervisor` only to delegated children carrying the bridge metadata.

Incoming messages can be configured to trigger a turn immediately, only for replies, or never. Held messages remain observable and end with an explicit terminal state such as `cancelled`, `superseded`, `acknowledged`, or `expired` rather than disappearing silently.

## Delivery model

Each enabled session registers with the local broker. The broker routes messages by stable session ID, name, ID prefix, or an explicitly scoped working directory. Only connected intercom sessions appear in `list`; an arbitrary open Pi process is not implicitly addressable.

The normal transport is local IPC:

- Unix socket on macOS/Linux;
- named pipe on Windows;
- an explicit localhost TCP escape hatch only when configured for an environment that cannot use named pipes.

The broker auto-spawns on first use, exits after its idle window only when the mailbox is empty, and is protected by a spawn lock. Clients use the existing reconnect path when the broker restarts. Cross-machine delivery, when enabled through an explicitly selected Herdr machine, relays through SSH; ordinary local sends never fall back to remote discovery.

## Configuration

Global state and configuration live under:

```text
~/.pi/agent/intercom/
```

When `PI_CODING_AGENT_DIR` is set, the extension uses `$PI_CODING_AGENT_DIR/intercom` instead. The directory contains the broker socket/pipe, PID and lock state, queued mailbox data, and `config.json`.

Useful settings include:

```json
{
  "inboundTrigger": "replies",
  "busyDelivery": "steer",
  "replyHint": true,
  "confirmSend": false,
  "stableId": "planner"
}
```

- `inboundTrigger`: `replies` by default; `always` preserves legacy wake-on-every-message behavior, and `never` disables automatic turns. Protocol-aware ordinary `send` messages are context-only unless `wake: true`; asks/replies still wake. Unmarked legacy senders retain implicit wake so an old task handoff is not silently ignored. New clients stamp `wakeProtocol: 1`; explicit `wake: false` wins over both defaults.
- A send result distinguishes `attention: "context_only"` from `"wake_requested"`; collapsed tool results and inbound cards display that intent too. `status` with a `messageId` reads only the existing in-memory receipt; execution/completion remain unknown without task evidence. Neither transport delivery, injection nor an exact reply proves task start or completion. See [attention display](docs/maintenance/2026-10-20-attention-display.md). See [mixed-version compatibility](docs/maintenance/2026-10-18-legacy-wake-compatibility.md) for rollout and rollback limits.
- `busyDelivery`: `steer` for prompt delivery, or `human-first` to wait for a safe turn boundary. This only controls delivery while busy; it does not turn ordinary status messages into new work.
- `stableId`: optional restart-stable session identity; use a distinct value per live session; after upgrading from 0.16.x, close all Pi sessions once if they previously shared one value;
- `confirmSend`: require UI confirmation for outbox requests;
- `status`: append a custom status suffix without replacing Pi's lifecycle status.

The default blocking `ask` timeout is 10 minutes. Override it with a positive value:

```bash
export PI_INTERCOM_ASK_TIMEOUT_MS=600000
```

Other runtime controls include `PI_INTERCOM_SCOPE_ID`, `PI_INTERCOM_STABLE_ID`, `PI_INTERCOM_LIVENESS_INTERVAL_MS`, and `PI_INTERCOM_LIVENESS_TIMEOUT_MS`.

Invalid configuration fails closed for inbound broker auto-triggering by using `inboundTrigger: "never"` until the file is corrected.

## Pi-subagents integration

When `pi-subagents` supplies bridge metadata, a delegated child receives the child-only `contact_supervisor` tool. Use:

- `need_decision` when the child is blocked on a product, API, or scope decision;
- `interview_request` when several structured answers are needed;
- `progress_update` for a meaningful plan change.

Normal sessions continue to use the regular `intercom` tool. Intercom does not replace bounded delegation: use `pi-subagents` for isolated implementation and use intercom for durable peer conversations or human-visible handoffs.

## Safety and privacy

- Messages are local by default and do not leave the machine.
- Client metadata such as cwd, model, PID, and status is display metadata, not authentication.
- Scope boundaries are exact; scoped sessions do not see unscoped sessions.
- Cancellation never pretends to remove work already injected into a Pi queue.
- Automatic retries are not performed. Author a new message and link it with `retryOf` when a retry is intended.
- Treat queued messages, session history entries, and debug/runtime files as local coordination data.

## Development

```bash
npm install
npm test
```

Tests use local fixtures and synthetic broker/session state. Do not use production credentials or private conversation data. The package is a Pi extension with a bundled local broker; installing it does not create a system daemon.

## License

MIT
