## Context

The repo is Vite + React 19 + TanStack Router (hash history, GitHub Pages base `/homepage/`),
Tailwind v4, Jotai for the little global state there is, `radix-ui` primitives, `lucide-react`
icons. Routes are file-based under `src/routes/` with an eager `foo.tsx` / lazy `foo.lazy.tsx`
split. `vite.config.ts` sets `routeFileIgnorePrefix: "-"`, so `-`-prefixed files under
`src/routes/` are excluded from route generation and can hold colocated components. There is
no test runner. Repo conventions: keep dependencies minimal, don't reach for a heavier
framework, don't prematurely extract components.

Web Crypto (`crypto.subtle`) natively provides ECDH (P-256/384/521), ECDSA, HKDF, AES-GCM,
RSA-OAEP, RSA-PSS, PBKDF2 and SHA-2. It does **not** provide OpenPGP message framing, MLS /
TreeKEM, or (portably) Ed25519/X25519. The terms used below — Scenario, Level, Script, Action,
Step, Snapshot, History, Frontier, Device, Wire, Packet, Eve, Attack — are defined in the root
`CONTEXT.md`.

## Goals / Non-Goals

**Goals**
- Every dot on the timeline corresponds to exactly one real `crypto.subtle` call. The page's
  claim to be worth reading rests on that 1:1 mapping.
- Advancing at the Frontier executes live; rewinding is a pure read. Both cheap.
- Eve's effects are genuine cryptographic outcomes — a tampered ciphertext fails its real GCM
  tag check.
- The engine is React-free and Scenario-agnostic, so `mail` and `meet` are later Scripts.
- v1 (slice 1) is `messaging` at `L1` with every surface working, not three half-Levels.

**Non-Goals**
- Wire compatibility with any real protocol; any cryptographic library; `mail`/`meet`;
  cross-tab devices; permalinks; a primitives bench; zh-TW copy. (See proposal's Non-Goals.)

## Decisions

### Decision 1: Live execution forward, immutable Snapshots backward

`▶` at the Frontier awaits the next Step's real crypto call and pushes a new frozen Snapshot.
Rewinding sets a cursor and reads `history[cursor]` — no re-execution, no serialisation. Each
Step returns a *new* Snapshot; nothing is mutated in place, so `CryptoKey` objects and byte
arrays are simply shared by reference between Snapshots.

```ts
const [history, setHistory] = useState<Snapshot[]>([initial]);
const [cursor, setCursor] = useState(0);

const view = history[cursor]; // rewind is a read

async function next() {
  if (cursor < history.length - 1) return setCursor(cursor + 1); // behind Frontier
  const snapshot = await runNextStep(history[history.length - 1]); // live crypto
  setHistory((h) => [...h, snapshot]);
  setCursor(history.length);
}
```

*Alternatives considered.* Precomputing the whole trace then replaying it — rejected: the
reader should be able to see that the call happens when they ask for it, and reader-supplied
plaintext makes a precomputed trace a lie anyway. Seeded determinism so a rewind can re-run —
rejected: it replaces `generateKey` with a hand-rolled derivation, which misrepresents keygen.
Snapshot cloning — unnecessary once nothing mutates.

### Decision 2: A Step is one `crypto.subtle` call; an Action is one intent

`Action` is the unit a person narrates (`alice.send("hi")`). It expands into Steps, each
carrying its operation, inputs, output and the Snapshot it produced. The timeline's dots are
Steps; Actions are the labelled groups above them. Steps that move bytes without transforming
them (transmit / receive) are Steps with `crypto: "none"`, so the Action's shape stays honest
without pretending a transmission is cryptography.

*Alternative:* one dot per Action, with all inner crypto in the panel — rejected: it collapses
"derived" and "sent" into one beat, which is exactly the confusion the page exists to remove.

### Decision 3: The Wire is Eve's console; failures are real

Every Packet in flight is a row in the Wire column with Eve's available Attacks as buttons.
An Attack mutates nothing retroactively — it appends Actions (`eve.replay`, `eve.tamper`) whose
Steps execute for real. When a Step's crypto call throws, the Step is recorded with
`outcome: { ok: false, error }` and the byte inspector shows the actual thrown error
(`OperationError` for a GCM tag mismatch). The page never fabricates a failure message.

Which Attacks a Packet offers follows from what Eve could actually do to it: `tamper` and `drop`
only while the bytes are still in flight, `replay` only once a sealed message has been delivered
— replaying is Eve keeping a copy of something that already worked and sending it again. Eve's
Actions are queued *ahead* of any pending delivery, so she acts before the recipient does.

Slice 1 ships `drop`, `replay`, `tamper` (flip one byte). `substituteKey` (MITM) is deferred to
the L3 slice, because a full MITM requires Eve to hold her own key pair and re-seal traffic —
machinery whose only pedagogical payoff is the signature check that L3 introduces.

### Decision 4: Levels are freely selectable; switching Level resets History

`L1`/`L2`/`L3` are viewpoints, not achievements — a returning reader jumps straight to L3.
Each Level's header states the weakness it still carries and offers the Attack that
demonstrates it. Because Levels differ in key material, switching Level starts a fresh
History (fresh keys), with the Level's own Script. No gating state is persisted anywhere.

*Alternative:* gate L2 behind actually landing the replay at L1 — rejected: strong teaching
pressure, but it traps the engineer who came to read the L3 trace, and it costs progress state.

### Decision 5: Private key material may be displayed, but can never enter a Packet

Devices generate key pairs with `extractable: true` so a panel can show the reader real private
key bytes — seeing that Alice's private scalar exists and never travels is much of the lesson.
The safety property is therefore enforced structurally instead: `Packet` carries only
`Uint8Array` payloads assembled by explicit `transmit` Steps, and a dev-only assertion checks
that no exported private material appears in any Packet. The panel labels displayed private
bytes as "never leaves this device".

*Alternative:* non-extractable keys — rejected: it would hide the very bytes the page is about,
and this page defends nothing real.

### Decision 6: Composing requires being at the Frontier

If the reader is scrubbed backwards and sends a message, the honest options are "branch the
History" or "refuse". v1 refuses: the compose box is disabled behind the Frontier and offers
"jump to now". No branching model, no truncation surprise.

### Decision 7: L1 is deliberately broken in specific, named ways

L1 = static ECDH P-256 → HKDF-SHA-256 → AES-GCM-256, 12-byte nonce whose last 4 bytes are a
per-direction send counter, AAD binding sender and counter.

As built, 20 Steps across 12 Actions (`crypto: none` marked `—`):

```
alice.generateKey      generateKey  ECDH P-256                   → (sk_A, pk_A)
bob.generateKey        generateKey  ECDH P-256                   → (sk_B, pk_B)
alice.publishPublicKey exportKey    raw(pk_A)                    → bytes
                       —            place on wire                → Packet pk_A
bob.publishPublicKey   exportKey    raw(pk_B)                    → bytes
                       —            place on wire                → Packet pk_B
bob.importPublicKey    —            arrival
                       importKey    raw → CryptoKey              (unauthenticated)
alice.importPublicKey  —            arrival
                       importKey    raw → CryptoKey
alice.ecdh             deriveBits   ECDH(sk_A, pk_B)             → ss (32 B)
bob.ecdh               deriveBits   ECDH(sk_B, pk_A)             → ss (identical)
alice.hkdf             importKey    ss as HKDF base (non-extractable)
                       deriveKey    HKDF(ss, salt, info)         → k (AES-256)
bob.hkdf               importKey    ss as HKDF base
                       deriveKey    HKDF(ss, salt, info)         → k
alice.send(m)          encrypt      AES-GCM(k, nonce(n), aad)    → ct ‖ tag
                       —            place on wire                → Packet ct
bob.receive            —            arrival
                       decrypt      AES-GCM(k, nonce, aad)       → m, or throws
```

The HKDF base-key import is its own Step rather than being folded into the derive: it is a
real `importKey` call, and the reason it must be non-extractable is worth a sentence of its own.

Bob **does not** track which counters he has already accepted at L1. That is not an oversight
to fix — it is what makes `eve.replay` succeed and what L2 exists to answer. The Level header
says so in as many words: no forward secrecy, replays accepted, no identity binding.

L2 adds a symmetric chain-key ratchet per message plus a DH ratchet on direction change (and
visibly deletes used message keys). L3 adds an X3DH-style prekey bundle — identity key, signed
prekey, one-time prekey, signature verification — and the offline-first-message story.

### Decision 8: Engine in `src/lib/e2ee/`, UI colocated in `src/routes/-e2ee/`

The engine is pure async functions over `crypto.subtle` plus data — no React, no DOM — so it
reads as cryptography and can be exercised from a console. UI colocates beside the route under
the existing ignore prefix, which keeps a large multi-file toy from spilling into
`src/components/` (which holds shared, cross-route components today).

```
src/lib/e2ee/
  types.ts        Scenario, Level, Action, Step, Snapshot, Packet, DeviceState
  primitives.ts   thin named wrappers over crypto.subtle + hex helpers
  session.ts      runNextStep(snapshot): Promise<Snapshot>, applyAction
  attacks.ts      drop, replay, tamper
  scenarios/messaging-l1.ts   the L1 Script
src/routes/e2ee.tsx        route + head()
src/routes/e2ee.lazy.tsx   page shell, History + cursor state
src/routes/-e2ee/          stage, device panel, wire, timeline, byte inspector
```

### Decision 9: English-only copy, outside `src/translations.ts`

`translations.ts` is a flat dictionary of short UI strings with a scramble transition between
zh-TW and en-US. This page carries an order of magnitude more prose than any existing route —
step explanations, weakness rationale, attack write-ups — for an audience reading about GCM tag
mismatches. Putting it in the dictionary would roughly double that file for content whose
zh-TW crypto terminology is a project in itself. Copy lives with the components; the page notes
it is English-only.

### Decision 10: CSS-only animation, motion-preference respected

Packet flight along the Wire and byte reveals use Tailwind/CSS transitions and keyframes; no
animation library (`tailwindcss-animate` is already present). All motion is skipped under
`prefers-reduced-motion: reduce`, where state changes apply instantly. Page opens at Step 0
with no autoplay; a play button auto-advances at a fixed cadence and stops at the Script's end
or on the first failing Step.

### Decision 11: Narrative rail left, sticky stage right — revises the original layout

The first build put the three columns across the full width with the timeline and byte
inspector stacked underneath. Reading it, the prose describing a Step sat most of a screen
below the panels it was describing, so following the story meant a long vertical eye jump per
Step, and the horizontal dot strip with truncated Action labels conveyed no sense of position.

Revised: the left column is the whole Script top to bottom, one row per Step grouped under its
Action, with the selected row expanded to carry that Step's prose and bytes. The right column
holds the transport controls and the stage, sticky, so the state stays in view while the reader
walks down the rail. Reading moves left↔right instead of up↕down. The separate inspector panel
is gone — its content lives in the expanded rail row.

Alongside it, **what changed is marked**: the field or Packet the selected Step wrote gets a ring
and a "this step" label. Because Snapshots are never mutated, this needs no bookkeeping at all —
`diffWorlds` compares two Snapshots by reference equality (`src/lib/e2ee/diff.ts`), so an
unchanged field is literally the same object. Steps do not have to declare what they touch, and
the marking cannot drift out of sync with what they actually did.

*Alternatives considered.* A compact navigation-only rail with the inspector still under the
stage — rejected, it fixes orientation but not the eye jump. Stage on top, sticky and condensed,
with a transcript scrolling below — rejected: the stage has to shrink hard to stay visible and
wide hex fights the narrow transcript.

## Risks / Trade-offs

- **Step count**: L3 approaches ~25 Steps, which is a long scrub. Mitigated by Action grouping
  and a jump-to-Action control; if it still reads badly, L3 collapses keygen Steps by default.
- **Displayed private bytes** could be misread as "the demo leaks keys". Mitigated by the panel
  label and by structurally keeping private material out of Packets (Decision 5).
- **Simplified stand-ins** (no OpenPGP/MLS) risk teaching a wrong thing if unlabelled. Every
  stand-in must carry a visible marker naming what the real protocol does instead.
- **No test runner** in the repo, so the engine is verified by `npm run check` plus manual
  stepping. The engine is deliberately pure so tests can be added later without redesign.
- **Bundle**: no new dependency, but the route is code-heavy; it is lazy-loaded like the others.

## Migration Plan

Additive: a new route, a new `src/lib/` directory, one entry in the `/` index listing. Nothing
existing changes behaviour. Slices land in order — L1 full surface, then L2, then L3, then
`mail`, then `meet` — each shippable on its own.

## Open Questions

None blocking slice 1.
