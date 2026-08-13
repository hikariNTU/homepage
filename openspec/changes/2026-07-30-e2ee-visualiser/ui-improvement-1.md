# E2EE Visualizer — UX/UI Improvement Plan

A redesign spec for the `/e2ee` route. The engine, the real `crypto.subtle` calls, the
Scenario/Level/Action/Step model all stay. What changes is everything the reader sees and
touches. This document is the brief; implement it against the existing engine.

---

## 1. Diagnosis — why the current page feels bad

1. **The page opens with reading, not doing.** Title paragraph → disclaimer box → level
   tabs → a full-height "L1" card with three weakness essays — all before the stage. The
   interesting object (the stage) starts below the fold. Interactivity is the product;
   prose is currently the product.
2. **Everything is the same visual weight.** Panels, cards, warnings, the inspector, the
   step list all use the same border + label + mono-text treatment. Nothing tells the eye
   "this is the current thing" vs "this is reference material."
3. **The step list and the transport controls are disconnected.** Steps live in a left
   sidebar; back/next/play live in a toolbar above the stage; "step 1/32" is a text
   fragment. There is no single object that reads as _the timeline_.
4. **No payoff.** A step executes and… some hex appears in a box. The single most
   animatable subject imaginable — secrets being derived, packets crossing a hostile
   wire — produces zero motion.
5. **The wire is a paragraph.** Eve's column is mostly explanatory text. The one panel
   that should feel dangerous feels like a footnote.

## 2. Core concept — "the stage is the app"

Reframe from _article with an embedded widget_ to _instrument with an embedded article_.

- The stage (Alice | Wire | Bob) + timeline is a **full-viewport instrument** that you see
  immediately on load. `100vh` minus a slim header. No scrolling required to operate it.
- All prose becomes **contextual**: attached to the step, level, or key it explains, shown
  when that thing is active. The intro paragraph shrinks to one line in the header. The
  disclaimer becomes a small dismissible footnote chip.
- Reading order = execution order. The reader learns ECDH by _watching_ `generateKey`
  happen, not by reading about it first.

## 3. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ header: title · one-line tagline · L1 L2 L3 · [explainer ⓘ]  │  ~56px
├──────────────┬────────────────────────────┬──────────────────┤
│              │                            │                  │
│   ALICE      │      THE WIRE (Eve)        │      BOB         │  the stage,
│   device     │   packets as objects       │      device      │  fills remaining
│   panel      │   attack controls          │      panel       │  height
│              │                            │                  │
├──────────────┴────────────────────────────┴──────────────────┤
│ TIMELINE — actions as segments, steps as ticks, transport    │  ~96px, docked
├──────────────────────────────────────────────────────────────┤
│ INSPECTOR — slides up over timeline when a step is selected  │  overlay drawer
└──────────────────────────────────────────────────────────────┘
```

Column proportions roughly `1 : 1.2 : 1` — the wire is the widest because packets and
attacks live there, inverting the current design where it's dead space.

### 3.1 Device panels (Alice / Bob)

- Mirror-symmetric. Bob is a reflection of Alice, reinforcing "each device does its own
  work."
- Key material as a **stack of key slots**, each a fixed-height row: slot name, status,
  and a byte strip. Empty slots render dimmed with a dashed outline and a `—` — the
  reader sees the _shape_ of what the device will eventually hold, so filling a slot is
  visible progress (this replaces the current long list of "—" labels which reads as
  broken UI).
- **Bytes on demand**: each filled slot shows a 8-byte hex preview in mono, single line,
  ellipsized. Click a slot → the inspector opens with full bytes, import/export format,
  and the step that produced it. Never dump 138 bytes into the panel.
- Private-key slots get a distinct treatment (e.g. hatched left edge + "never leaves this
  device" on hover/focus) — a persistent visual grammar for _secret_ vs _public_
  material, used consistently everywhere (also on packets: everything on the wire uses
  the public treatment by definition).
- The **compose box** sits at the bottom of each device panel, always visible, disabled
  with a reason ("no message key yet — run the handshake") until usable. Sending is the
  reward; keep it in sight from second one.
- A small per-device counter row (messages sent / received) — data the replay attack will
  later make meaningful.

### 3.2 The wire

- Packets are **physical objects**: small cards that visibly travel left→right or
  right→left across the wire column when a send step executes (~600ms ease, CSS
  transform). After arriving they stack in a vertical log, newest on top.
- Each packet card: direction arrow, seq number, kind (pubkey / ciphertext), a short byte
  strip, and — while "in flight" — the attack affordances.
- **Eve's controls live on the packets themselves**, not in a separate console: hover or
  focus a packet still in flight (or use a "hold packets" toggle that pauses delivery) →
  `drop · replay · flip byte · swap key` buttons appear on the card. Attacking a thing by
  touching the thing beats a remote control panel.
- The wire column header carries Eve's one-line identity ("Everything here is public.
  Eve keeps a copy of everything.") and a **captured-packets count** — her growing archive
  is the setup for the replay attack.
- When an attack causes a failure on the receiving side, the consequence renders **in the
  victim's panel** as a red error slot showing the real thrown `OperationError` — the wire
  shows the cause, the device shows the effect.

### 3.3 Timeline (replaces both the sidebar step list and the toolbar)

One docked strip, the only transport surface on the page:

- **Actions as labeled segments** (`alice.generateKey()`, `alice.publishPublicKey()`, …)
  laid horizontally; **steps as ticks** within each segment. Executed ticks solid,
  frontier tick pulsing, future ticks hollow. This is a media-player scrubber for
  cryptography — instantly familiar.
- Transport controls (⏮ back · ▶ step · ⏵ play · ↺ reset) sit at the left end of the
  strip, adjacent to what they control. `space` = step, `←/→` = scrub, documented in a
  keyboard hint on first hover.
- Scrubbing behind the frontier puts the whole stage into a visually distinct **history
  mode**: stage desaturates slightly, a "viewing history — nothing is being computed"
  banner chip appears on the timeline, compose boxes disable. Current design says this in
  small gray text; make it a mode you can _see_.
- The current step's one-sentence description shows inline on the timeline strip (e.g.
  "Alice generates an identity key pair — `crypto.subtle.generateKey`"). Full detail
  lives in the inspector.
- Steps appended by the reader's own sends and by attacks grow the timeline live at the
  right edge — the reader watches their own actions become history.

### 3.4 Inspector (drawer)

- Slides up over the timeline when a step tick or a key slot is clicked; `esc` or click-
  away closes. Never permanently occupies layout.
- Three-part layout: **IN** (arguments, each value linking back to the slot/packet it
  came from) → **operation** (the literal `crypto.subtle.…` signature) → **OUT** (result
  bytes, length, format note). Hex truncated at 32 bytes with "show all n bytes."
- Clicking a value that references key material highlights the corresponding slot in the
  stage — the inspector and the stage are one linked system, not two displays.

## 4. Levels

- L1/L2/L3 as segmented control in the header. L2 and L3 render as **designed shells**:
  selectable, showing their name, one-paragraph promise ("L2 · Double ratchet — a fresh
  key per message; fixes replay and forward secrecy"), a dimmed preview of their stage
  (extra key slots visible but inert), and a "coming next" tag. Not padlock-disabled
  buttons — let the reader window-shop the roadmap.
- The three **weakness essays move out of the header card** and become three compact
  **weakness chips** pinned under the wire header (`replays accepted · no forward
secrecy · no identity binding`). Each chip: one line + an **"attack" button** that runs
  the demonstration script against the live session (auto-plays the needed steps, then
  performs the attack, then scrolls the timeline to the damning step). The essay text
  appears as the attack unfolds, step by step — teach the weakness by committing it.
- "answered by → L2" on a chip links to the level control, previewing the fix.

## 5. Motion system (the payoff)

All CSS transforms/opacity; no library. Every motion answers "what just changed?"

1. **Packet flight** — the signature move. Card lifts out of the sender's panel, travels
   across the wire (600ms), lands in the receiver's panel or the wire log.
2. **Slot fill flash** — when a step writes a key slot, the slot flashes (background
   pulse, ~400ms) and its byte strip types in over ~200ms.
3. **Derivation lines** — when `deriveBits`/`deriveKey` runs, a brief animated line
   connects the input slots to the output slot (own private + peer public → shared
   secret). This is _the_ moment of E2EE; it deserves the most care. SVG overlay, drawn
   once per derive step, fades after ~1.5s, replays on step re-select.
4. **Frontier pulse** — the next-step tick breathes gently; the primary affordance is
   always findable.
5. **Failure shake** — tampered ciphertext failing its tag check: packet card shakes,
   error slot in the victim panel appears with the thrown error. Red reserved
   exclusively for attack consequences.
6. `prefers-reduced-motion`: replace flight/lines with instant state + highlight.

## 6. First-visit experience

- Load state: stage visible, all slots empty-but-shaped, timeline at step 0, frontier
  tick pulsing, and one clearly primary button: **"▶ Run the handshake"** centered on the
  wire (plus the step button on the timeline for cautious readers).
- "Run the handshake" auto-plays through key generation → exchange → derivation at a
  readable pace (~1 step/900ms, skippable by click), stopping right before the first
  message send with the compose box now enabled and focused-hinted: **"say something —
  it will really be encrypted."** The reader's first hands-on act is the emotionally
  loaded one (sending their own secret), not `generateKey`.
- Explainer prose ("not Signal-compatible, an explainer not an implementation") lives
  behind the header ⓘ, popover on demand.

## 7. Hierarchy & visual language rules

- **One accent, one alarm.** Accent color = current/frontier/interactive. Red = attack
  consequences only. Everything else near-monochrome. (Current design uses the same
  maroon for headings, borders, buttons, and warnings — nothing can pop.)
- Three text roles, strictly: mono for bytes/identifiers/code, a strong UI face for slot
  labels and controls, regular body only inside the inspector and popovers. No small-caps
  label + mono value + helper sentence stacked on every element as today.
- Depth encodes liveness: the stage panels sit on the base; in-flight packets and the
  inspector drawer float above it; history mode flattens everything.
- Density: device panels are instrument-dense (fixed-height rows, no prose); explanation
  surfaces (inspector, popovers) are article-loose. Don't blend the two registers.

## 8. Acceptance checklist

- [ ] Stage + timeline fully visible and operable at 1440×900 with zero scroll.
- [ ] First meaningful interaction ≤ 1 click from load ("Run the handshake").
- [ ] Every mutation of visible state is animated or flashed; nothing changes silently.
- [ ] Bytes: ≤ 8 preview bytes in panels; full bytes only in inspector.
- [ ] All three L1 weaknesses attackable via one click from their chip, each ending on a
      visibly rendered real error/consequence.
- [ ] Timeline scrub, step, play, reset all keyboard-operable; history mode visually
      unmistakable.
- [ ] Reader-composed message travels the wire, decrypts on the peer, and appears as
      appended timeline steps.
- [ ] `prefers-reduced-motion` respected.
- [ ] No explanatory paragraph rendered by default anywhere above the stage.
