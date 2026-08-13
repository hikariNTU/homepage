## Why

E2EE is explained everywhere with the same static drawing: two people, a padlock, a line
between them. That drawing hides the only interesting parts — that *each device* does distinct
work with material the other never sees, that the secret is derived rather than transmitted,
and that a naive version of the protocol is broken in ways you can watch happen.

The audience is engineers. A page that runs the actual `crypto.subtle` calls, shows the bytes
each one consumed and produced, lets the reader step through them one call at a time, and lets
them attack the wire themselves, is worth more than any diagram — and building it is the point
as much as reading it is.

## What Changes

- New `/e2ee` route: an interactive E2EE visualiser, English-only, engineer-facing.
- A **stage** of three columns — `Alice` | `Wire` (Eve's console) | `Bob`. Each Device panel
  shows its own key material and counters; material never crosses a panel boundary that it
  would not cross in reality.
- A **timeline** below the stage. One dot per Step (one `crypto.subtle` call), grouped under
  the Action that produced them. `▶` at the Frontier performs the real cryptographic call;
  scrubbing behind the Frontier re-reads History and performs nothing.
- A **byte inspector** under the timeline: for the selected Step, the operation, its inputs,
  and its output as hex — truncated with expand.
- **Levels** `L1`→`L3` for the `messaging` Scenario, freely selectable. Each Level's header
  names the weakness it still has and offers a one-click Attack demonstrating it against the
  currently selected Level.
- **Eve acts on the Wire**: per Packet, drop / replay / flip a byte / substitute a public key.
  Consequences are real — a tampered AES-GCM ciphertext fails its tag check and the thrown
  `OperationError` is what the page displays.
- The stage **is** the playground: a compose box on Alice's panel sends the reader's own
  plaintext, appending real Steps to History.
- A pure, React-free engine in `src/lib/e2ee/` so `mail` and `meet` later arrive as new
  Scripts rather than a rewrite.

## Capabilities

### New Capabilities
- `e2ee-visualiser`: Stepping through a real Web Crypto E2EE session one cryptographic
  operation at a time, per device, with a rewindable History, selectable protocol depth
  Levels, an adversary-controlled Wire, and reader-supplied plaintext.

### Modified Capabilities
<!-- None. -->

## Impact

- **Routes**: new `src/routes/e2ee.tsx` (route + `head()`) and `src/routes/e2ee.lazy.tsx`
  (page shell), per the repo's eager/lazy split. `src/routeTree.gen.ts` regenerates.
- **Engine**: new `src/lib/e2ee/`, alongside the existing helpers in `src/lib/`. No React, no
  DOM; pure async functions over `crypto.subtle`.
- **Components**: new `src/routes/-e2ee/` colocated UI (ignored by the router via the existing
  `routeFileIgnorePrefix: "-"`).
- **Index**: the `/` listing gains an entry, like the other toys.
- **Dependencies**: none new. Web Crypto is a platform API; animation is CSS/Tailwind only.
- **i18n**: none — copy is local to the route and English-only, deliberately outside
  `src/translations.ts` (see design).
- **Docs**: root `CONTEXT.md` added, carrying the Scenario/Level/Script/Action/Step/Snapshot
  glossary this change introduces.

## Non-Goals

- The `mail` and `meet` Scenarios. v1 ships `messaging` only; the engine must not make them
  hard, but it must not speculatively build for them either.
- Any cryptographic library. Where Web Crypto lacks a primitive (OpenPGP, MLS/TreeKEM,
  Ed25519), a simplified stand-in is used and **labelled in the UI as a stand-in**.
- Wire compatibility with Signal, MLS, OpenPGP, or SFrame. This is an explainer, not an
  implementation anyone should depend on.
- Real cross-tab devices. Devices are simulated panels in one tab.
- Shareable/permalink session state.
- A standalone primitives bench (raw algorithm calculator).
- Translation into zh-TW.
