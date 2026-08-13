# E2EE Visualizer — UX/UI Improvement Plan, revision 2 ("game framing, folded in")

Supersedes the layout and hierarchy sections of `ui-improvement-1.md`. Everything in
`design.md` about the engine — Scenario / Level / Script / Action / Step / Snapshot, the 1:1
Step ↔ `crypto.subtle` mapping, live-forward + immutable-rewind, genuine failures — is
unchanged and non-negotiable here.

Origin: a design pass produced a "game" mock (HUD, inventory, boss challenges, quest bar). It
diagnoses the right disease. `ui-improvement-1.md` §1.4 already admitted the page has **no
payoff**; the game mock is the first proposal with an answer. But parts of it rename the
subject matter, and the reader is an engineer learning ECDH — not a player. This revision keeps
the mechanics and drops the costume.

---

## 1. What the game framing actually fixes

Three real defects, in order of how much they hurt:

1. **No orientation.** A flat list of 20–32 steps tells you where the cursor is but not where
   you are *in the story*. Milestones (keygen → exchange → derive → first message → break it)
   are the missing coarse layer.
2. **No payoff.** Deriving the same 32 bytes on both sides with nothing secret crossing the
   wire is the entire point of ECDH, and today it renders as two hex boxes that happen to
   match. Nothing says *that was the trick*.
3. **Nothing looks like state.** "Public key: —" repeated six times reads as a broken form, not
   as an inventory waiting to be filled. Slot-shaped, icon-typed, filled-vs-empty does.

## 2. Adopt / adapt / cut

| Mock element | Call | Why |
| --- | --- | --- |
| Quest bar: `KEYGEN → EXCHANGE → DERIVE ◀ you are here → FIRST MESSAGE → BREAK IT` | **Adopt**, as an added coarse layer | Fixes orientation. Additive — the per-Step rail stays; see §3. |
| Keys as icon slots; public = outline, private = ink-filled | **Adopt** | A persistent visual grammar for secret vs public, which `ui-improvement-1.md` §3.1 asked for and never specified. Everything on the Wire is outline *by definition* — that reads as an argument, not decoration. |
| Empty slots as shaped `?` placeholders | **Adopt**; drop "moves to unlock" | Show the shape of what the device will hold. Label the *step that fills it* ("filled by `deriveKey`"), not a move count. |
| Packet as a token riding an animated dashed track between endpoint nodes | **Adopt** | Better articulated than §5.1's "card flies across". Dashed track makes the Wire a *place* even when empty. |
| Eve's moves (`DROP · REPLAY · FLIP BYTE · SWAP KEY`) attached under the packet | **Adopt** | Already the §3.2 direction: attack the thing by touching the thing. `SWAP KEY` stays L3-only (`design.md` Decision 3). |
| Avatar tiles for Alice / Bob / Eve | **Adopt** — Lucide `UserIcon` in a tile, no illustration | Cheap orientation, zero dependencies. |
| Achievement toast: "Same secret, zero bytes sent" | **Adopt the sentence, cut the trophy** | That line is the pedagogical punchline. Render it as a one-time callout on the derive Step, styled as a finding, not as a badge unlock. |
| OPS progress meter (8/32) | **Adapt** | Keep as honest progress through the Script — it literally counts `crypto.subtle` calls. Label it as calls, not points. No score. |
| "HIT BLOCKED · TAG CHECK FAILED" | **Adapt — must not replace the real error** | Spec requirement: adversary actions surface *genuine* outcomes. Style the banner however, but `OperationError` and its real message stay on screen. A prettier lie fails the whole premise. |
| Boss challenge names: `GHOST ECHO`, `TIME HEIST`, `FACE OFF` | **Cut** | Replaces the ubiquitous language (`replay`, `forward secrecy`, `identity binding`) with invented names the reader can't search for, take to a spec, or use at work. Keep the *card + `RUN ATTACK` button + CLEARED state* — the cleared state is genuinely good, it proves you committed the weakness rather than read about it. Real names on the cards. |
| "EVE'S ARENA" | **Cut** | "THE WIRE — Eve keeps a copy of everything" is both truer and scarier. |
| Keyring pips per character | **Cut** | Decoration; the slots already show what's held. |
| LVL 1/2/3 badges with lock icons | **Adopt as-is** | Matches the existing `LevelPicker`. L2/L3 stay locked because they're unbuilt, not to pace the reader. |
| "New loot pulses **red**" | **Keep the pulse; see §4.3** | Not a mock error — Modernist's accent *is* red. Resolved by weight, not hue: hairline accent for "changed", solid accent field for "attacked". |

## 3. Two-tier timeline — quest bar *plus* rail

The mock replaces raw ticks with milestones. Don't. The 1:1 Step ↔ call mapping is the page's
only claim to be worth an engineer's time; hiding steps behind milestones spends the asset.

- **Quest bar** — thin horizontal strip in the header. Five to six named checkpoints per Level,
  each derived from Action groups, with a "you are here" marker. Coarse, always visible,
  clickable to seek to the first Step of that checkpoint. Orientation only.
- **Rail** — the existing vertical per-Step rail (`-e2ee/rail.tsx`), unchanged in principle:
  one row per Step, grouped by Action, the selected row expanding to show prose and IN/OUT
  bytes beside the state it describes. This is what fixed the original "hard to follow the
  text and the status" complaint; do not regress it into a horizontal scrubber, which is the
  layout that failed.

The mock has no room for the rail — it is `100vh`, `overflow:hidden`, three full-height columns,
and a footer holding transport + checkpoints + a single next-step sentence. It drops per-Step
granularity entirely, which is exactly the risk named above. Resolution: **the footer expands
upward into the rail.** It is already the only transport surface; clicking a checkpoint (or a
`steps` affordance) grows it into the Step list for that stretch, with the selected Step's
prose and IN/OUT bytes. Collapsed by default, so the instrument still reads at a glance;
one click from full detail. Keeps `100vh`, keeps one transport home, keeps the 1:1 mapping
reachable.

This revises `design.md` Decision 11 by addition, not replacement.

## 4. The design system: Modernist

Source of truth is the Claude Design project **Modernist** (`theme.json`, `styles.css`,
`readme.md`), read 2026-07-30. It is flat, architectural, set entirely in Archivo: near-mono
red on a light ground, a visible modular grid, **zero corner radius**, strong 2px rules.
Nothing floats, nothing is decorated — alignment and divider strength do the organising.

### 4.1 Tokens as adopted

| Role | Token | Value |
| --- | --- | --- |
| ground | `--color-bg` | `#f3f2f2` |
| surface | `--color-surface` | `#eae9e9` |
| ink | `--color-text` | `#201e1d` |
| accent | `--color-accent` | `#ec3013` |
| divider | `--color-divider` | ink 40%, drawn at **2px** |
| ramps | `--color-neutral-100…900`, `--color-accent-100…900` | OKLCH, shared lightness scale |
| type | `--font-heading` / `--font-body` | Archivo, heading weight 800 |
| space | `--space-1…8` | 4 / 8 / 12 / 16 / 24 / 32 px |
| radius | `--radius-sm/md/lg` | **0** |
| elevation | `--shadow-sm/md/lg` | ink-tinted |

Space maps 1:1 onto Tailwind `1/2/3/4/6/8`, so wire the tokens into the Tailwind v4 `@theme`
block and keep using Tailwind utilities. Do not hard-code a hex, a font, or a px the tokens
already carry. `h6`'s uppercase 0.08em tracking is already how this page labels things — keep it
as the one label style.

### 4.2 It is a mono scheme — no second hue exists

`readme.md` is explicit: `--color-accent-2-*` is a machine-derived stand-in, "treat them as one
role." Consequences for what is currently on screen:

- **`sky-*` for Bob and `amber-*` for "changed this step" are both out.** Alice and Bob are
  distinguished by mirrored position and label, not colour — which is the truer statement
  anyway: they are peers running identical code.
- "Changed this step" becomes an accent hairline plus an `accent-100` tint.
- Public vs private key material carries the page's only fill distinction: **outline = public,
  solid ink field = private**. Everything on the Wire is outline by definition.

### 4.3 One hue, three weights — replaces "one accent, one alarm"

`ui-improvement-1.md` §7 asked for an accent and a separate alarm. Impossible here: the accent
is red and the palette is mono. Modernist also already spends solid accent on something else —
`readme.md`: *"the primary is a solid accent fill"* — and the mock follows that, filling the
LVL 1 badge, `RUN ATTACK`, `NEXT MOVE` and the OPS meter. So the alarm cannot be *solid accent*
either. Three weights of one hue:

| Weight | Means | Where |
| --- | --- | --- |
| accent line + `accent 8%` tint + `accent-700` text | **new / changed this step** | a slot that just filled |
| solid accent **field** | **primary action** | `NEXT MOVE`, `RUN ATTACK`, active level badge |
| solid accent **header strip**, label reversed out, real error in mono on the body below | **attack consequence** | the failed tag check |

The third weight is new — it is not in the mock, and it fixes a defect in it (§5.1).

Body-size text in the accent must use `--color-accent-700`; the accent-to-ground pair is tuned
to 3:1, which covers chrome and large type but not paragraphs.

Purple `main-*` is dropped on this route entirely. It stays the homepage's colour; `/e2ee` is
Modernist ink-and-red end to end.

### 4.4 Documented deviations

Two, both because the system does not cover this page's subject:

1. **Dark mode.** `theme.json` is `band: light`; `readme.md` only glances at a dark ground
   (pressed states go to `--color-accent-400` there). This site ships dark. Derived, not
   invented: `neutral-900` ground, `neutral-100` ink, accent held, pressed to `accent-400`.
2. **A mono face.** Modernist is "set entirely in Archivo", which has no tabular hex alignment
   — and this page is columns of hex. A system mono stack is scoped strictly to byte strips and
   `crypto.subtle` signatures. Nothing else gets it.

### 4.5 Structural rules to obey

- **Zero radius.** Every `rounded-*` currently in `src/routes/-e2ee/` comes out.
- **2px rules, not hairlines, not whitespace.** Section boundaries and the Alice/Wire/Bob
  divisions are `--color-divider` at 2px.
- **Grid `1fr 1.25fr 1fr`**, per the mock. `readme.md` asks for equal-width cells, but the Wire
  carries four blocks (track, Eve's moves, challenges, loot) against the devices' one, and the
  mock's own author took the extra 0.25. Accepted deviation.
- **Wire ground is `--color-neutral-100`**, devices sit on `--color-bg`, raised cards inside the
  Wire are white. The mock hard-codes `#fff` for those, which `readme.md` forbids — introduce a
  `surface-raised` token rather than copying the literal.
- **Flush left**, including labels inside wide buttons. No centred hero copy.
- **Lucide icons** (`*Icon` imports) — already the repo convention and the system's own choice.

### 4.6 Unchanged constraints

- **Zero dependencies.** Motion is CSS transform/opacity; the dashed track is a border, the
  derivation line an inline SVG. No animation library.
- **`prefers-reduced-motion`.** Flight and derivation lines degrade to instant state plus the
  existing highlight.
- **Real vocabulary wins every tie.** Protocol term over game label; `CONTEXT.md` is the
  authority.

## 5. Defects in the mock, and what ships instead

Read from `Interactive E2EE visualizer/E2EE Game Mock.dc.html` (1600×1050, Modernist-linked).
Its sibling `e2ee-ux-plan.md` is byte-identical to `ui-improvement-1.md` apart from emphasis
markers — same document, nothing new in it.

### 5.1 Acquisition and failure look identical

Mock line 85 (shared secret acquired) and line 216 (tag check failed) carry the *same*
treatment: `2px solid var(--color-accent)`, `accent 8%` fill, `accent-700` label. The best
moment on the page and the worst one are indistinguishable at a glance; only the icon and the
wording separate them. Fixed by the third weight in §4.3 — failure gets a reversed-out solid
accent header strip, acquisition keeps line-plus-tint.

### 5.2 "TIME HEIST" demands an attack the engine cannot run

Its copy is *"steal the key later, read every past message"* — key compromise, not a wire
attack. `src/lib/e2ee/attacks.ts` has `drop | replay | tamper` (and `substituteKey` deferred to
L3). Nothing compromises a device. So the card cannot carry a working `RUN ATTACK` button today.

**Build it.** A `compromise` Attack that reads the victim's stored `messageKey` and decrypts
every ciphertext in Eve's loot is real cryptography, small, and the most persuasive argument for
forward secrecy the page can make — the reader watches their own earlier messages open. This is
a scope addition to `attacks.ts` beyond slice 1 as specified; flagging rather than assuming.

### 5.3 `CLEARED` means two different things

The mock's third card reads `CLEARED · fixed in LVL 3` — i.e. *deferred*, not *demonstrated*.
Two states, two labels: **`DEFERRED → LVL 3`** (neutral, no button) versus **`CLEARED`** (you
ran the attack and saw it land). Conflating them tells the reader they beat something they never
touched.

### 5.4 Smaller corrections

- Packet token animates `ride 2.4s infinite alternate` — a decorative loop. Ships as a one-shot
  on the delivery Step, replayed when that Step is re-selected.
- Alice's compose box has the hint as a `value`, not a `placeholder` — it would be sent verbatim.
- Keyring pips sit next to the inventory grid that already shows the same fill state. Still cut.
- `EVE'S ARENA · THE WIRE` and the boss names remain cut per §2; the mock's Eve header sentence
  (*"everything here is public — she keeps a copy of everything"*) and `LOOT ×3` counter are
  both kept.

## 6. Acceptance checklist (delta on `ui-improvement-1.md` §8)

- [ ] Quest bar visible without scrolling; marks the current checkpoint; seeks on click.
- [ ] Per-Step rail still present and still expands the selected Step's prose + bytes.
- [ ] Every key slot is visibly typed public vs private (outline vs solid ink field), filled vs
      empty-and-shaped, in both colour schemes.
- [ ] No corner is rounded anywhere on the route; section rules are 2px.
- [ ] No colour on the page outside the Modernist neutral and accent ramps — no `sky-*`, no
      `amber-*`.
- [ ] Alice and Bob are legible as peers without relying on hue.
- [ ] Accent appears as line/text for current-and-interactive, and as a solid field only on an
      attack consequence.
- [ ] Mono face appears only on byte strips and `crypto.subtle` signatures.
- [ ] Private slots carry "never leaves this device", and no packet ever renders with the
      private treatment.
- [ ] The derive Step renders the "same secret, zero bytes sent" callout once, with both
      devices' 32 bytes shown as equal.
- [ ] A tampered delivery shows the literal `OperationError` name and message alongside
      whatever styled banner wraps it.
- [ ] Each weakness card names the real weakness (`replay`, `forward secrecy`, `identity
      binding`), runs its attack in one click, and shows a cleared state afterwards.
- [ ] Body-size accent text uses `--color-accent-700`, never `--color-accent`.
- [ ] No `main-*` purple anywhere on the route.
- [ ] A just-filled slot and a failed tag check are distinguishable with the icons and text
      covered up.
- [ ] Weakness cards distinguish `CLEARED` (demonstrated) from `DEFERRED → LVL n` (not yet
      buildable).
- [ ] The footer expands to the per-Step rail in one click and collapses back.
