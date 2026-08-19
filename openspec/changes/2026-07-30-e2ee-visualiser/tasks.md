Slice 1 only: `messaging` at `L1` with every surface working. Later slices listed at the end.

## 1. Engine types and primitives (`src/lib/e2ee/`)

- [x] 1.1 `types.ts`: `Scenario`, `Level`, `DeviceId`, `DeviceState`, `Packet`, `Action`, `Step`, `Snapshot` — Step carries `{ id, actor, action, op, crypto: "subtle" | "none", inputs, output | error, standIn? }`
- [x] 1.2 `primitives.ts`: named thin wrappers — `generateEcdhKeyPair()`, `exportRawPublicKey()`, `importRawPublicKey()`, `ecdhSharedSecret()`, `hkdfAesKey()`, `sealAesGcm()`, `openAesGcm()`, plus `toHex`/`fromHex` and a 12-byte nonce builder (last 4 bytes = send counter)
- [x] 1.3 Params fixed in one place: ECDH P-256, HKDF-SHA-256, AES-GCM-256, 12-byte nonce, AAD binding sender + counter
- [x] 1.4 Dev-only assertion that no exported private key material appears in any `Packet` payload

## 2. Session engine

- [x] 2.1 `scenarios/messaging-l1.ts`: the L1 Script as data — keygen ×2, publish ×2, agree ×2, derive ×2, then send/receive Actions; each Step carries its prose and its weakness notes
- [x] 2.2 `session.ts`: `initialSnapshot(level)` and `runNextStep(snapshot): Promise<Snapshot>` — pure, returns a new frozen Snapshot, never mutates
- [x] 2.3 Record a thrown crypto call as a Step with `error`, not an exception escaping to React
- [x] 2.4 `appendAction(snapshot, action)` so composing and Eve's attacks extend the pending Step queue
- [x] 2.5 L1 recipient deliberately does **not** track accepted counters (Decision 7) — leave a comment saying why, so it is not "fixed" later
- [x] 2.6 `attacks.ts`: `drop`, `replay`, `tamper(byteIndex)` as Action factories

## 3. Route shell

- [x] 3.1 `src/routes/e2ee.tsx` — route definition + `head()` metadata, light
- [x] 3.2 `src/routes/e2ee.lazy.tsx` — `createLazyFileRoute`, owns `history: Snapshot[]` + `cursor`, `next()` / `prev()` / `seek()` / `reset()`, Level selection
- [x] 3.3 Confirm `routeTree.gen.ts` regenerates and `src/routes/-e2ee/*` is **not** picked up as routes

## 4. Stage

- [x] 4.1 Device panel (in `-e2ee/stage.tsx`) — key material, counters, plaintext read so far; private bytes labelled "never leaves this device"
- [x] 4.2 Wire (in `-e2ee/stage.tsx`) — Packets in flight as rows, each with Eve's `drop` / `replay` / `tamper` controls
- [x] 4.3 `-e2ee/stage.tsx` — three columns, packet-flight CSS transition, `prefers-reduced-motion` honored
- [x] 4.4 Compose box (in `-e2ee/stage.tsx`) — plaintext box on Alice (and Bob), disabled behind the Frontier with a "jump to now" affordance

Built as three files rather than six — `-e2ee/stage.tsx` holds the device panels, the wire and
the compose box, per the repo's "don't prematurely extract" convention.

## 5. Rail, controls and inspector

- [x] 5.1 `-e2ee/rail.tsx` — narrative rail: one row per Step grouped under its Action, selected row expanded with prose + bytes, click-to-seek, click-the-next-row-to-run; `-e2ee/controls.tsx` holds `◀ ▶`, play/pause, reset; play stops at Script end or first failed Step (Decision 11)
- [x] 5.2 `-e2ee/step-detail.tsx` — selected Step's op, inputs, output as truncated hex, expandable; failed Step shows the real thrown error
- [x] 5.3 Frontier vs past visually distinct (executed / present / not yet run)
- [x] 5.4 `src/lib/e2ee/diff.ts` + ring/"this step" markers on the field or Packet the selected Step wrote (Decision 11)

## 6. Level framing

- [x] 6.1 `-e2ee/level-picker.tsx` — L1/L2/L3 selectable, L2/L3 present but marked not-yet-built in slice 1
- [x] 6.2 L1 header naming its weaknesses (no forward secrecy, replays accepted, no identity binding) with a one-click "show me" running the replay Attack
- [x] 6.3 After a successful Attack, name the Level that answers it
- [x] 6.4 Switching Level resets History with fresh keys

## 6b. Modernist rebuild (`ui-improvement-2.md`)

The layout in sections 4–6 above worked but read as an article with a widget in it. Rebuilt as an
instrument against the Modernist design system, with the game framing's mechanics kept and its
invented vocabulary dropped.

- [x] 6b.1 `src/index.css` — `mn-*` tokens as `@theme inline` with a `.dark` override, `mn-pop`/`mn-blink`/`mn-halo` keyframes; Archivo added to `index.html`
- [x] 6b.2 `-e2ee/ui.tsx` — `Label`, `Hex`, `Btn`, `Plate`, `ConsequenceStrip`, `Tip`: the one-hue-three-weights rule in one place (§4.3)
- [x] 6b.3 `-e2ee/hud.tsx` — level badges, OPS meter, all opening prose moved behind a Radix Popover
- [x] 6b.4 `-e2ee/device-panel.tsx` — key material as slot tiles (outline public / solid ink private / dashed empty with the call that fills it), attack consequence rendered on the victim
- [x] 6b.5 `-e2ee/wire.tsx` — packet token on a dashed track, Eve's moves under it, weakness cards with real names and distinct `CLEARED` vs `DEFERRED → Ln`, loot list
- [x] 6b.6 `-e2ee/quest-bar.tsx` + `-e2ee/checkpoints.ts` — checkpoints derived from Action ids, transport, and a Radix Collapsible that expands into the rail (§3)
- [x] 6b.7 `-e2ee/byte-dialog.tsx` — full bytes in a Radix Dialog; panels show a 6-byte preview and nothing more
- [x] 6b.8 `-e2ee/callout.tsx` — "Same secret, zero bytes sent" at the moment it becomes true, and the replay-accepted note
- [x] 6b.9 `-e2ee/stage.tsx`, `-e2ee/controls.tsx`, `-e2ee/level-picker.tsx` deleted; no `main-*` purple and no `rounded-*` left on the route
- [x] 6b.10 Fold the mock's `TIME HEIST` card into a real `compromise` Attack — Eve takes the unlocked device, the panel lists what she found, and one attempt is made on the oldest ciphertext she captured. At L1 that is a real `decrypt` returning the plaintext; from L2 there is no key left to call it with, and the Step says so rather than staging a call that must fail

## 9. L2 — double ratchet

- [x] 9.1 `primitives.ts`: Signal's two KDFs as real calls — `importChainKey`/`hmac` with `0x01`/`0x02` domain separators for the chain KDF, `rootRatchetBits` (HKDF salted with the old root key, 512 bits out) for the root KDF, plus `importAesKey` and `hkdfBits`
- [x] 9.2 `types.ts` + `world.ts`: `RatchetState` (root key, sending and receiving chain keys, own and peer ratchet public keys, counts, `burned`), `PacketHeader` widened to carry the sender's ratchet public key, `withRatchet`
- [x] 9.3 `scenarios/common.ts`: the setup Actions L1/L2/L3 share, extracted from `messaging-l1.ts` rather than copied
- [x] 9.4 `scenarios/ratchet.ts`: the DH ratchet (4 Steps), its receiving mirror (4 Steps), the chain KDF (4 Steps per message), the seal, the delete-the-key Step, and delivery split into `receive-*` / `open-*` so a refused header cancels the decrypt instead of failing twice
- [x] 9.5 The freshness check as its own `crypto: "none"` Step: a counter behind the receiving chain is `ReplayRejected` naming the deleted key; ahead of it is `SkippedMessage` naming the simplification
- [x] 9.6 `scenarios/messaging-l2.ts`: root-key init from the static ECDH secret, identity key pair adopted as the initial ratchet key, `LevelInfo` with two `defences` and three honest `weaknesses`
- [x] 9.7 A used message key is deleted in a visible Step and the label kept in `burned` — the bytes are gone, the ledger is not

## 10. L3 — X3DH

- [x] 10.1 `primitives.ts`: ECDSA `generateSigningKeyPair`/`signBytes`/`verifyBytes`, `sha256` for the safety number, and length-prefixed `encodeFields`/`decodeFields` so a bundle is one tamperable byte string
- [x] 10.2 `types.ts` + `world.ts`: `PrekeyState`, `PeerBundle`, `withPrekeys`; `PacketHeader` carries the initiator's identity and ephemeral keys on the first message only
- [x] 10.3 `scenarios/messaging-l3.ts`: Bob publishes signing key, signed prekey, signature, one-time prekey and goes offline; Alice fetches, verifies, imports, computes the safety number
- [x] 10.4 The four exchanges as four `deriveBits` Steps on each side, combined through one HKDF over `0xFF`×32 ‖ DH1‖DH2‖DH3‖DH4
- [x] 10.5 The offline story is structural: `SendOptions.beforeDelivery` runs Bob's mirror X3DH after her message is on the wire, so he catches up from the header alone
- [x] 10.6 `substituteKey` Attack — swaps the signed prekey and leaves the signature; `crypto.subtle.verify` returns false and `cancelActionIds` aborts the handshake, so nothing is ever sealed
- [x] 10.7 Documented deviations: identity is two key pairs (ECDH + ECDSA) because Web Crypto has no XEdDSA, and the first message's AAD binds the header rather than `IK_A ‖ IK_B` directly. Both carry `standIn` notes on the Steps themselves
- [x] 10.8 Trust on first use left standing and named: the safety number is shown as the out-of-band answer, because a bundle Eve re-signs with her own identity key verifies perfectly

## 11. UI for the new Levels

- [x] 11.1 `-e2ee/device-panel.tsx`: slots per Level — L2 shows root key, both chain keys, own ratchet key and the live message key; L3 adds the bundle and the safety number; a dashed "deleted · unrecoverable" ledger lists burned keys
- [x] 11.2 `-e2ee/wire.tsx`: one card component for both `weaknesses` and `defences`, with three distinct end states (`demonstrated` / `deferred → Ln` / `nothing here fixes this`); moves come from `LevelInfo.attacks`
- [x] 11.3 `e2ee.lazy.tsx`: `sendActionsFor(level, world, …)`, per-move packet selection for `compromise`/`substituteKey`, and notes fired off real failed Steps — `ReplayRejected`, `NoKeyForThisMessage`, `SignatureRejected`
- [x] 11.4 `diff.ts` watches ratchet and prekey subfields individually, since the sub-objects are replaced on every patch
- [x] 11.5 `checkpoints.ts` maps the new Action ids (`-bundle`, `-fetchbundle`, `-x3dh`, `-dhratchet`)
- [x] 11.6 Levels are all selectable; the ⓘ names each Level's actual parameters

## 12. Game feel — structure and chassis

The reference the shape came from is a cyberpunk HUD; the palette is not adopted,
the *structure* is. The page turned out to already be that structure, so this is
a restructure and a chassis, not a rebuild.

- [x] 12.1 `/e2ee` pins itself to Modernist's dark ramp with `.mn-dark` whatever the site theme is — `index.css` gains `.mn-dark` alongside `.dark` on the same token block, so no value is duplicated
- [x] 12.2 Chassis utilities in `index.css`, one per layer, none of which touch `border` or `background-color` so the existing accent/ink border grammar still means what it meant: `mn-frame` (inset bevel + four corner ticks, retintable through `--mn-tick`, defaulting to `currentColor` so it reads on ink and on raised alike), `mn-etch` (hatch, also `currentColor`-keyed so it survives a reversed-out header), `mn-lane` (recessed channel with tick marks), `mn-stage` (the panel's empty half)
- [x] 12.3 `ui.tsx`: `ByteGlyph` renders a slot's own first bytes as a bit grid, and `ArtPlate` is the item face on each tile. Art is generated from the real value rather than drawn, so it reshuffles exactly when the bytes do — a ratchet step is visible on the plate
- [x] 12.4 Inventory tiles are uniform height with a fixed hero row, so a tile's size says nothing about its contents and the grid can be scanned for what is filled
- [x] 12.5 Device panels are four fixed regions — header, inventory, stage, console — with the stage deliberately mostly empty: it is the ground a flight crosses and where an arriving packet lands next to the plaintext it becomes
- [x] 12.6 The wire's hairline is now a lane: recessed, ticked, with a socket at each end and the token centred on its position
- [x] 12.7 `-e2ee/flight.tsx`: `FlightLayer` holds anchors and a fixed overlay, `FlightDriver` launches from the Snapshot — a Packet that now exists flies from the tile holding the key that sealed it, an inbox that just grew is flown into. Triggered by state, never by a click, so rewinding History animates the same way the first pass did. Skipped entirely under reduced motion
- [x] 12.8 Segmented OPS bar, framed Level tabs, framed checkpoint lane, `>` prompt on the console
- [x] 12.9 All of the above lives in `-e2ee/e2ee.css`, attached by the repo's own `useStyleData` hook (already used by the CV route) while the route is mounted and detached when it is not — so neither the download nor the `.mn-dark` ramp reaches another page. Only the `@theme inline` mapping stays in `index.css`, because `@theme` has to be in the Tailwind entry for `bg-mn-*` to exist at all
- [x] 12.10 `--mn-solid` / `--mn-on-solid` for the reversed-out surfaces (header, private tiles, tooltips, sockets, notes). On the dark ramp `--mn-ink` is the *foreground*, so `bg-mn-ink` turned every one of them into a white slab
- [x] 12.11 Portalled surfaces carry `mn-dark` themselves: Radix renders them into `document.body`, outside the route, where the tokens fell back to the light ramp
- [x] 12.12 Byte inspector: exactly the trigger's width, `mn-unroll` out of the tile's bottom edge, opens on hover as well as click, and *which* card is open is one Jotai atom so moving between tiles is a single handoff instead of two components racing
- [x] 12.13 No animated `box-shadow` anywhere — the pulsing halo repainted every frame. A static ring says the same thing
- [x] 12.14 `compromise` now yields loot: `World.stolen` holds the real bytes Eve took off the device, shown in her column apart from the captured packets, each item saying what holding it does and does not buy her. Verified headless — L1 hands her the live message key, L2/L3 hand her no message key at all
- [x] 12.16 `useStyleData` teardown reference counted on the tag itself (`data-style-data-users`), so a shared or remounting id cannot have the first unmount pull the sheet out from under a live caller; an id already present is reused rather than rewritten
- [x] 12.17 A compromise marks what it costs, and the mark is **derived** rather than written: `exposure.ts` asks one question of the current World — is the key that sealed this Packet a key Eve is holding? `same-key` only at L1, where one message key covers the whole session so the identity is certain; nothing at L2/L3, where the used keys are deleted. The flag it replaces could only mark packets that existed when the attack ran, so every message sent *after* the theft came out unmarked while being just as readable. Verified headless: at L1 a message sealed after the theft marks itself, at L2/L3 nothing marks at any point
- [x] 12.17a `World.cracked` records Packets Eve genuinely opened, with the plaintext the call returned. The card shows the recovered sentence on the tile and above the hex in the inspector, because when someone reads what they should not have been able to read, the sentence is the point and the ciphertext is the footnote
- [x] 12.17c One state, not two. "She holds the key that would open this" was a distinction nobody needed, so the engine opens them: `eveOpenAction` is one real `crypto.subtle.decrypt` resolving its target when it runs, queued once per captured sealed message by `compromise` and once per later send by `sendActionsFor`. `StolenItem.key` carries the device's own `CryptoKey` handle — the same object that was on the phone, not a re-import — so the 1 Step = 1 call ledger still holds. Verified headless: at L1 every message before *and* after the theft ends up with real plaintext; at L2/L3 every one stays closed
- [x] 12.17b `StolenItem.kind` so the derivation matches on a stable discriminant instead of label prose
- [x] 12.18 Loot items are cards rather than chips — `h-12` in a responsive grid, hex preview, larger byte face — sized below the device tiles (`h-14`) so the inventory still leads
- [x] 12.15 `-e2ee/art-wanted.md` lists the images still wanted, where each one plugs in, and what it would replace

## 7. Integration

- [ ] 7.1 Add `/e2ee` to the `/` index listing alongside the other toys — blocked: every entry in `sites` needs a cover screenshot in `src/assets/sites/` and `find()` throws without one, so this waits on an `e2ee.webp`
- [x] 7.2 Note on the page that it is English-only and an explainer, not a usable implementation

## 8. Verification

- [x] 8.1 `npm run format:check` clean
- [x] 8.2 `npm run lint` — zero warnings
- [x] 8.3 `npm run typecheck` clean
- [x] 8.4 `npm run build` clean
- [x] 8.6 Engine exercised headless in Node: full L1 run (secrets match), replay accepted, tamper → real `OperationError`, drop cancels the queued delivery
- [x] 8.7 Same harness extended over all three Levels, every check passing: scripts run clean end to end; L2/L3 root keys identical on both devices; message keys null after use with the burn recorded; replay refused as `ReplayRejected` at L2/L3 and accepted at L1; `compromise` opens an old message at L1 and nothing at L2/L3; tamper throws a real `OperationError` at every Level with an empty inbox after it; a reply steps the root key forward; `substituteKey` at L3 fails `verify`, seals nothing, and leaves an empty queue
- [ ] 8.5 Manual (user): step each Level start to finish; tamper a Packet and see a real `OperationError`; replay at L1 (accepted) and at L2 (refused, key gone); steal a device at L1 (reads old messages) and at L2 (reads nothing); swap a key in L3's bundle and watch `verify` abort the handshake; send own plaintext both ways to force a DH ratchet; scrub backwards and forwards; reduced-motion behaves; both colour schemes; the packet token actually flies

## Later slices (not this change's implementation scope)

- Slice 2 — L2: symmetric chain-key ratchet + DH ratchet on direction change, visible key deletion, forward-secrecy Attack
- Slice 3 — L3: X3DH-style prekey bundle, signature verification, offline first message, Eve's `substituteKey` MITM
- Slice 4 — `mail` Scenario: absent recipient, hybrid RSA-OAEP + AES-GCM, key-server trust
- Slice 5 — `meet` Scenario: per-frame keys over a media-shaped stream

## 13. Multi-device refactor and mission select

- [x] 13.1 `DeviceId` opened from the `"alice" | "bob"` union to a string, so the two-device assumptions stop type-checking silently and have to be stated
- [x] 13.2 `World.alice` / `World.bob` replaced by `World.devices` (a map) plus `World.deviceOrder` (the stage's column order); read through the new `deviceOf`, which throws on an unknown id
- [x] 13.3 `peerOf` deleted — it *was* the two-device assumption. Every Action builder that needed the other side now takes an explicit `peer` / `to`, which is the shape a chosen conversation needs anyway
- [x] 13.4 `nonceFor` derives its 8-byte sender tag from the id rather than matching on two names; `initialWorld` refuses reserved ids (`wire`, `eve`) and ids that collide within that prefix, since a shared prefix would reuse a nonce under one key
- [x] 13.5 `diffWorlds` iterates `deviceOrder`, and skips a device that did not exist a Step ago rather than diffing against undefined
- [x] 13.6 UI reads devices positionally (`deviceOrder[0]` / `[1]`) instead of naming them: the stage columns, the wire's direction arrows and lane positions, the flight driver's inbox watch, and the panel's display name (now `nameOf`)
- [x] 13.7 `Level` extended to L6 with `MESSAGING_L4/L5/L6` in `scenarios/planned.ts` — attachments, backups, sealed sender — all `available: false`, no defences claimed, and `scriptFor` throws if one is ever selected
- [x] 13.8 New `mission-select.tsx`: the header chips replaced by a dialog. One card per mission with its number, what it fixes, what it still gets wrong, and how many of Eve's moves it answers; unbuilt ones shown locked rather than hidden. Called "mission" because "stage" already names the three-column playfield
- [x] 13.9 Verified headless: all three Levels run identically to before the refactor (same step counts, same delivered text, L1 cracks after a theft and L2/L3 do not); a three-device world constructs; all three new guards throw

## 14. L4–L6 built

- [x] 14.1 `messaging-l3.ts` split so the handshake is reusable: `x3dhScript(world, opening)` takes the first message as a callback, and `firstMessageOptions` / `responderX3dhAction` are exported. Every Level from L4 up is that handshake plus one idea, so only the handshake is shared
- [x] 14.2 `SendOptions.resolveText` added to the ratchet: L4's plaintext is a pointer at a blob that does not exist when the Action is built, so the body is resolved from the world at the moment of sealing
- [x] 14.3 `DeviceState.sentLog` records what a device sent, in the clear — the app's own message list, which the ratchet never touches and L5 backs up
- [x] 14.4 `World.store` added: the third place bytes can live, after a Device and the Wire, and the only one nobody in the conversation controls
- [x] 14.5 **L4 attachments.** Fresh CSPRNG AES-GCM key (not from the ratchet), file sealed, SHA-256 over the ciphertext, blob uploaded to a CDN, and `{blob, key, sha256}` sent as an ordinary sealed message. Recipient downloads, checks the digest, imports the key and opens the file. New Attack `swapBlob`: Eve seals a file of her own — valid AES-GCM, wrong bytes — and SHA-256 refuses, cancelling the decrypt
- [x] 14.6 **L5 backups.** The plaintext history is dumped from the device, a six-digit PIN and salt are drawn, PBKDF2-SHA-256 at 100 000 iterations derives the key, the archive is sealed and handed to the provider. The derive Step measures itself and states what the full million costs on this machine. New Attack `crackBackup`: 24 genuine derive-and-decrypt attempts against the provider's copy, with the real PIN planted among them and a `standIn` note saying exactly that. Zero defences — the Level fixes nothing, which is the finding
- [x] 14.7 **L6 sealed sender.** Ephemeral ECDH to the recipient's identity key, HKDF, and a second AES-GCM layer over the sender's name and the whole inner message. `Packet.hidesSender` + `Packet.envelope` added: `from` and `header` stay for routing and are documented as not being what travelled, and every Eve-facing surface reads `envelope`. New Attack `traceTraffic`: no `crypto.subtle` call at all — destinations, byte counts and order, and the conversation described from its shape
- [x] 14.8 `scenarios/planned.ts` deleted; `scriptFor` and `sendActionsFor` are exhaustive over all six Levels with no `default:` throw left
- [x] 14.9 Responder now records the sender's identity key on the device (it is a fact he learned from the header), so an L6 envelope can be sealed in either direction rather than only by whoever started the conversation
- [x] 14.10 UI: media / vault / seal slots in the device panel, an "attach" control at L4, the store rendered in Eve's column, envelope-aware packet cards and lane token (a sealed envelope has no origin to fly from), three new move buttons with their own unavailability hints
- [x] 14.11 Verified headless: all six Levels run start to finish with zero failed Steps; L1/L2/L3 step counts unchanged (20 / 39 / 49); replies in both directions at every Level; L4's file opens byte-identical and refuses after `swapBlob`; L5's archive is recovered by a real decrypt; L6 seals and reveals the sender both ways
- [ ] 14.12 Manual (user): play L4, L5 and L6 through; run each of the three new moves; check the store panel and the envelope rendering read right at both widths
