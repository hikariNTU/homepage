# CONTEXT

Ubiquitous language for this repo. Glossary only — no implementation details, no decisions.
Decisions live in `openspec/changes/*/design.md` and `docs/adr/`.

## E2EE visualiser

The `/e2ee` route: an interactive illustration of how end-to-end encryption works on each
device, driven by real Web Crypto calls.

### Scenario

A product shape whose E2EE story differs in kind: `messaging`, `mail`, or `meet`. Two
Scenarios differ in _what problem the protocol must solve_ — a live session, an absent
recipient, a media stream — not merely in depth.

Not a "mode" (overloaded in UI code) and not a "protocol" (Level also varies the protocol).

### Level

A depth rung within one Scenario: `L1` … `L6`. Each Level is a more complete protocol than
the one below it, and exists because a named weakness in the Level below can be demonstrated.
Levels are freely selectable — a Level is a viewpoint, not an achievement.

L1–L3 build the session: a static key, then the double ratchet, then X3DH. L4 upward are all
"L3's session, plus one idea the session cannot solve on its own" — an attachment that has to
outlive forward secrecy, a backup that bypasses it entirely, an envelope that hides who sent
what. A Level is allowed to fix nothing: L5 has no defences at all, which is the finding.

### Script

The ordered Actions belonging to one Scenario + Level pairing. A Script is the plot; it says
what happens, in what order, to whom.

### Action

One intent expressed at the level a person would describe it: `alice.send("hi")`,
`bob.receive`, `eve.replay(packet)`. An Action is not itself a unit of cryptography — it
expands into Steps.

### Step

Exactly one cryptographic operation, together with the inputs it consumed and the output it
produced. A Step is the smallest unit the reader can advance by, and the unit the byte
inspector describes. Steps that move bytes without transforming them (transmit, receive) are
still Steps, and are marked as performing no cryptography.

### Snapshot

The frozen state of the whole world immediately after one Step: both Devices' key material
and counters, the Wire's contents, and what has been read in the clear by whom. Snapshots are
never edited — a Step produces a new one.

### History

The ordered Snapshots produced so far. History is what makes the past re-readable; it is not
a prediction of the future.

### Frontier

The most recent Snapshot in History — the present. Advancing at the Frontier performs real
cryptography; moving anywhere behind it only re-reads History.

### Device

One participant's machine. A Device owns key material. The defining property of a Device is
that its private key material is never observable outside it — neither to another Device, nor
to the Wire, nor to Eve.

A `DeviceId` is an open string, not a fixed pair of names, and `World.devices` is a map keyed
by it. Today every Level starts with two — `alice` and `bob` — but nothing in the engine is
built on there being two, because multi-device is the point of the map. `wire` and `eve` are
reserved ids: they can appear as a Step's actor and are refused as Device ids. Ids must stay
distinct within their first 8 characters, which is the sender tag inside every AES-GCM nonce.

### Wire

The transport between Devices, and everything an adversary can reach. Whatever is on the Wire
is considered public. The Wire is Eve's territory.

### Packet

A unit of bytes in flight on the Wire — a public key, a sealed message, a prekey bundle, a
sealed-sender envelope. A Packet is what Eve can see, keep, re-send, or alter.

A sealed envelope (L6) keeps its real `from` so the engine can route it, and sets
`hidesSender`. While that flag is set, `from` and `header` are delivery bookkeeping rather
than facts about the wire: what travelled is `envelope`, and every Eve-facing surface —
including her own Attacks — must read that instead.

### Store

Bytes parked on a server: a CDN blob (L4), a backup archive (L5). Not a Packet — it does not
move, is never delivered, and belongs to nobody in the conversation. It is the third place
bytes can live, after a Device and the Wire, and the only one whose operator can keep them
after everyone involved has deleted the message.

### Eve

The adversary. Eve holds the Wire: she may read any Packet, drop it, re-send it, alter its
bytes, or substitute her own. Eve is not a Device — she never obtains private key material,
and every consequence of her actions is a real cryptographic outcome, never a staged one.

### Attack

A named thing Eve does that a given Level fails to withstand. An Attack belongs to the Level
it defeats, and motivates the Level above it. A defeated Attack shows up as a genuine
cryptographic failure, not a message about one.
