/**
 * Vocabulary for the E2EE visualiser. The terms here (Scenario, Level, Script,
 * Action, Step, Snapshot, History, Frontier, Device, Wire, Packet, Eve, Attack)
 * are defined in the repo root `CONTEXT.md` — keep both in step.
 *
 * Nothing in `src/lib/e2ee/` may import React or touch the DOM.
 */

/**
 * Byte string. Pinned to `ArrayBuffer` rather than `ArrayBufferLike` because Web
 * Crypto's `BufferSource` will not accept a possibly-shared buffer.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/** A product shape whose E2EE story differs in kind. Only `messaging` exists today. */
export type Scenario = "messaging";

/**
 * A depth rung within one Scenario. Higher Levels answer weaknesses of lower ones.
 * L4 upward are specified but not built — `LevelInfo.available` is what says so.
 */
export type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

/**
 * A device handle.
 *
 * Deliberately an open string rather than the `"alice" | "bob"` union it used to
 * be. The union made every two-device assumption invisible — it type-checked, so
 * nothing pointed at the places that would break when one person owns a phone and
 * a laptop. Ids are short slugs (`alice`, `alice-laptop`); nothing parses them,
 * but `nonceFor` tags the nonce with the first 8 bytes, so they must be distinct
 * within that prefix. `assertDeviceIdsAreDistinct` enforces it at construction.
 */
export type DeviceId = string;

/**
 * Ids that are not devices. They share the `DeviceId` space because a Step's
 * actor is one field, and the transport and the adversary have to be nameable in
 * it — so they are reserved instead, and `initialWorld` refuses to hand either to
 * a real Device.
 */
export const WIRE = "wire";
export const EVE = "eve";
export const RESERVED_ACTOR_IDS: readonly string[] = [WIRE, EVE];

/** Who performed a Step: a device, or one of the reserved ids above. */
export type Actor = DeviceId;

/** One labelled value shown in the byte inspector. */
export type StepValue = {
  label: string;
  bytes?: Bytes;
  text?: string;
  /** Why this value looks the way it does, or what it is not. */
  note?: string;
};

export type StepOutcome =
  | { ok: true; values: StepValue[] }
  | { ok: false; errorName: string; errorMessage: string };

/**
 * A Step is exactly one cryptographic operation, or one honest admission that no
 * cryptography happened (`crypto: "none"` — transmit, receive, drop).
 */
export type StepMeta = {
  id: string;
  actionId: string;
  actor: Actor;
  /** Short human title, e.g. "Derive shared secret". */
  title: string;
  /** The call performed, e.g. `crypto.subtle.deriveBits`. `null` when none. */
  op: string | null;
  crypto: "subtle" | "none";
  /** What this Step means, in a sentence or two. */
  prose: string;
  /**
   * Set when this Step simplifies something the platform does not provide. The
   * UI must show this, naming what the real protocol does instead.
   */
  standIn?: string;
};

export type PacketKind =
  | "public-key"
  | "prekey-bundle"
  | "sealed-message"
  /**
   * L6 only. A sealed message wrapped a second time, to a key only the recipient
   * holds, so the envelope the server routes on carries no sender.
   */
  | "sealed-envelope";

/**
 * The cleartext header on a sealed message. `sender` and `counter` exist at every
 * Level; the ratchet key appears from L2 (it is how the receiver knows a DH
 * ratchet step is due), and the X3DH fields only on L3's very first message.
 */
export type PacketHeader = {
  sender: DeviceId;
  counter: number;
  /** L2+: the sender's current ratchet public key. */
  ratchetPublicRaw?: Bytes;
  /** L3 initial message only: Alice's identity and ephemeral public keys. */
  identityPublicRaw?: Bytes;
  ephemeralPublicRaw?: Bytes;
  /** L3 initial message only: which of Bob's prekeys this message consumed. */
  usedOneTimePreKey?: boolean;
};

export type PacketStatus = "in-flight" | "delivered" | "dropped";

/**
 * Bytes in flight on the Wire. Whatever is here is public — Eve reads, keeps,
 * re-sends, or alters it. A Packet must never carry private key material; see
 * `assertPacketCarriesNoPrivateMaterial`.
 */
export type Packet = {
  id: string;
  from: DeviceId;
  to: DeviceId;
  kind: PacketKind;
  label: string;
  payload: Bytes;
  /**
   * Present on sealed messages: the public header. Everything here travels in
   * the clear and is bound into the AAD, so altering any of it fails the tag.
   */
  header?: PacketHeader;
  status: PacketStatus;
  /** True once Eve has altered the payload. */
  tampered: boolean;
  /** True when this Packet is a re-send of an already delivered one. */
  replayOf?: string;
  /**
   * L6: the sender is inside the envelope, not on it.
   *
   * `from` still holds the real id because the engine has to route the bytes
   * somewhere — but that field is a delivery detail of this simulation, not part
   * of what travels. Nothing on Eve's side may read it while this flag is set,
   * and `traceTraffic` is written against `to`, size and order for that reason.
   */
  hidesSender?: boolean;
  /**
   * L6: the bytes that actually travelled — the envelope.
   *
   * `payload` and `header` stay as the inner message because the engine has to
   * deliver it, but while `hidesSender` is set they are not what was on the wire.
   * Every Eve-facing surface reads this field instead.
   */
  envelope?: Bytes;
  /** L6: the envelope's ephemeral public key. All the routing layer ever gets. */
  envelopeEphemeralRaw?: Bytes;
};

/**
 * A Packet Eve genuinely decrypted, with what came out.
 *
 * A record of work she did, not a property of the Packet: the call happened, at a
 * point in History, and returned these bytes. Whether a Packet is *readable* by her
 * is a different question and never stored — see `openablePackets`.
 */
export type CrackedMessage = {
  packetId: string;
  plaintext: Bytes;
  text: string;
};

export type SentEntry = {
  packetId: string;
  to: DeviceId;
  counter: number;
  text: string;
};

export type InboxEntry = {
  packetId: string;
  from: DeviceId;
  counter: number;
  text: string;
  /** A replay this Level failed to reject, which is the whole point at L1. */
  wasReplay: boolean;
};

/**
 * The double ratchet, as Signal defines it: a root key that steps forward on
 * every change of direction, and one sending and one receiving chain that step
 * forward on every message.
 *
 * `burned` is the visible half of forward secrecy. A used message key is removed
 * from the world entirely — this list keeps only its label, so the panel can say
 * "message key #0 · deleted" without the bytes still existing anywhere.
 */
export type RatchetState = {
  /** Own current sending ratchet key pair. Replaced on every direction change. */
  selfKeyPair: CryptoKeyPair | null;
  selfPublicRaw: Bytes | null;
  /** The peer's ratchet public key, as last seen in a header. */
  peerPublic: CryptoKey | null;
  peerPublicRaw: Bytes | null;
  rootKey: Bytes | null;
  sendChainKey: Bytes | null;
  recvChainKey: Bytes | null;
  /** Messages sent on the current sending chain, and read on the current receiving chain. */
  sendCount: number;
  recvCount: number;
  /**
   * The chain key currently imported as an HMAC key, held between the import Step
   * and the two `sign` Steps that consume it. Cleared as soon as the chain has
   * stepped forward.
   */
  chainHmacKey: CryptoKey | null;
  /** Labels of message keys that have been used and deleted, newest last. */
  burned: string[];
};

/**
 * X3DH key material. Bob publishes a bundle; Alice consumes it. Real X3DH uses
 * one Curve25519 identity key for both Diffie-Hellman and signatures via XEdDSA
 * — Web Crypto cannot do that, so the signing key is separate and every Step
 * that touches it carries a stand-in note saying so.
 */
export type PrekeyState = {
  /** ECDSA P-256. Signs the signed prekey. */
  signingKeyPair: CryptoKeyPair | null;
  signingPublicRaw: Bytes | null;
  /** ECDH P-256. The medium-term prekey, signed by the identity key. */
  signedPreKeyPair: CryptoKeyPair | null;
  signedPreKeyPublicRaw: Bytes | null;
  signedPreKeySignature: Bytes | null;
  /** ECDH P-256. Used once, then gone. */
  oneTimePreKeyPair: CryptoKeyPair | null;
  oneTimePreKeyPublicRaw: Bytes | null;
  oneTimePreKeyUsed: boolean;
  /** Initiator side: the ephemeral key generated for this one handshake. */
  ephemeralKeyPair: CryptoKeyPair | null;
  ephemeralPublicRaw: Bytes | null;
  /** The four X3DH Diffie-Hellman outputs, in order, as each Step produces one. */
  dhOutputs: Bytes[];
  /** The peer's bundle as received, once its signature has been checked. */
  peerBundle: PeerBundle | null;
  /** The peer's identity signing key, imported once and used by the verify Step. */
  peerVerifyKey: CryptoKey | null;
  /** Result of `crypto.subtle.verify` over the peer's signed prekey. */
  signatureVerified: boolean | null;
  /** SHA-256 over both identity keys, sorted — the "safety number" to compare. */
  safetyNumber: Bytes | null;
};

/**
 * L4. An attachment is the one thing a messenger deliberately does *not* push
 * through the ratchet: it gets its own random AES key, the ciphertext goes to an
 * ordinary CDN, and only a pointer travels inside a sealed message.
 *
 * The key therefore outlives every chain key in the session, on purpose — the file
 * has to still open next week. That is the trade, and it is a hole either way.
 */
export type MediaState = {
  /** The random per-file key. Never derived from the ratchet, and never deleted. */
  key: CryptoKey | null;
  keyBytes: Bytes | null;
  /** The file itself: the sender's before, the recipient's after opening it. */
  plaintext: Bytes | null;
  ciphertext: Bytes | null;
  /** SHA-256 over the ciphertext, so a swapped blob is caught before decrypting. */
  digest: Bytes | null;
  /** Which object in `World.store` this refers to. */
  objectId: string | null;
  /** Recipient side: what the digest check concluded. `null` until it has run. */
  digestMatched: boolean | null;
};

/**
 * L5. The device's own plaintext history, sealed under a key derived from a short
 * PIN and handed to the provider. Where end-to-end encryption actually ends for
 * most people.
 */
export type VaultState = {
  /** Six digits, chosen at random when the Level starts. Never sent. */
  pin: string | null;
  salt: Bytes | null;
  /** The archive before sealing — every message this device can still read. */
  archiveBytes: Bytes | null;
  /** The same archive, sealed. Held so the upload Step can be honest about doing no cryptography. */
  sealedArchive: Bytes | null;
  backupKey: CryptoKey | null;
  backupKeyBytes: Bytes | null;
  objectId: string | null;
};

/**
 * L6. The sealed-sender envelope: an ephemeral ECDH to the recipient's identity
 * key, wrapping an already-sealed message together with the sender's name.
 */
export type SealState = {
  ephemeralKeyPair: CryptoKeyPair | null;
  ephemeralPublicRaw: Bytes | null;
  envelopeKey: CryptoKey | null;
  envelopeKeyBytes: Bytes | null;
  /** Recipient side: the sender id that came out of the envelope. */
  revealedSender: DeviceId | null;
};

/** The public half of a peer's prekey bundle, decoded from the wire. */
export type PeerBundle = {
  signingPublicRaw: Bytes;
  identityPublicRaw: Bytes;
  signedPreKeyPublicRaw: Bytes;
  signedPreKeySignature: Bytes;
  oneTimePreKeyPublicRaw: Bytes;
};

/**
 * One Device's own state. Private material lives here and nowhere else: it is
 * never copied into a Packet, and never read from the other Device's state.
 */
export type DeviceState = {
  id: DeviceId;
  identityKeyPair: CryptoKeyPair | null;
  /** Own public key, raw — the only key bytes that may travel. */
  publicKeyRaw: Bytes | null;
  /**
   * Own private key bytes (pkcs8), exported purely so the panel can show them.
   * Displayed under a "never leaves this device" label; never placed in a Packet.
   */
  privateKeyBytes: Bytes | null;
  peerPublicKey: CryptoKey | null;
  peerPublicKeyRaw: Bytes | null;
  sharedSecret: Bytes | null;
  hkdfBaseKey: CryptoKey | null;
  /**
   * The key the next AES-GCM call will use. Static for the whole session at L1;
   * from L2 it is derived per message and deleted immediately after use, which is
   * exactly what forward secrecy means.
   */
  messageKey: CryptoKey | null;
  messageKeyBytes: Bytes | null;
  /** L2+ only. */
  ratchet: RatchetState | null;
  /** L3 only. */
  prekeys: PrekeyState | null;
  /** L4 only. */
  media: MediaState | null;
  /** L5 only. */
  vault: VaultState | null;
  /** L6 only. */
  seal: SealState | null;
  /** Counter for messages this Device has sent; feeds the nonce and the AAD. */
  sendCounter: number;
  /** A message sealed but not yet handed to the Wire. */
  outbox: { packetId: string; ciphertext: Bytes; counter: number } | null;
  inbox: InboxEntry[];
  /**
   * What this device has sent, in the clear, as any messaging app keeps it. The
   * ratchet deletes the *keys*; the message list on the phone is untouched by that,
   * which is exactly what L5 backs up.
   */
  sentLog: SentEntry[];
};

/** Everything that exists at one instant. Replaced wholesale by each Step. */
/**
 * One piece of key material Eve took off a device, with the real bytes she got.
 *
 * Separate from `packets` because it did not travel: a captured Packet is Eve
 * doing her job on the Wire, and this is Eve holding the phone. Keeping the two
 * apart is the point — the wire loot is what encryption is *supposed* to leak.
 */
export type StolenKind =
  | "identity-private"
  | "message-key"
  | "root-key"
  | "send-chain"
  | "recv-chain";

export type StolenItem = {
  id: string;
  /** What kind of key this is, so nothing has to match on the label prose. */
  kind: StolenKind;
  label: string;
  from: DeviceId;
  bytes: Bytes;
  /**
   * The usable key handle, where the device had one. Not a copy or a re-import —
   * the same `CryptoKey` object that was sitting on the phone she is holding, which
   * is what makes her later `decrypt` calls real rather than staged.
   */
  key?: CryptoKey;
  format: string;
  /** What holding this actually buys her, which is the whole lesson. */
  note: string;
};

export type World = {
  /**
   * Every device that exists, by id. A map rather than named fields: `alice` and
   * `bob` as World keys meant "two" was baked into the type of the world itself.
   * Read it through `deviceOf`, which throws on an unknown id.
   */
  devices: Record<DeviceId, DeviceState>;
  /** Stable order, which is the order the stage lays its columns out in. */
  deviceOrder: DeviceId[];
  packets: Packet[];
  /** Everything Eve has taken off a device, in the order she took it. */
  stolen: StolenItem[];
  /** Packets she has actually opened, with the plaintext each call returned. */
  cracked: CrackedMessage[];
  /**
   * Bytes parked on a server: a CDN blob at L4, a backup archive at L5.
   *
   * A third place bytes can live, and the only one nobody in the conversation
   * controls. Unlike a Packet it does not move and is never delivered — it simply
   * sits there, for as long as the operator likes.
   */
  store: StoredObject[];
  /**
   * Public keys Eve generated for herself, by the id of the Action that made them.
   *
   * An impersonation takes two Steps — generate a key, then write it into
   * something in flight — and the bytes shown in the first must be the bytes
   * written in the second. Keeping them in the World rather than in a closure is
   * what makes that true: a Step's only channel to the next one is the World it
   * returns, and the second Step then genuinely performs no cryptography.
   */
  forged: Record<string, Bytes>;
};

export type StoreHolder = "cdn" | "backup";

export type StoredObject = {
  id: string;
  holder: StoreHolder;
  label: string;
  bytes: Bytes;
  uploadedBy: DeviceId;
  /** What the operator can do with this, which is the reason it is shown. */
  note: string;
  /** True once Eve has replaced the bytes with her own. */
  swapped: boolean;
};

export type StepResult = {
  world: World;
  inputs: StepValue[];
  outcome: StepOutcome;
  /**
   * Queued Steps belonging to these Actions are removed. Used when Eve drops a
   * Packet: the delivery that was going to happen simply never does.
   */
  cancelActionIds?: string[];
};

/** A Step that has not run yet: its metadata plus the work it will do. */
export type PendingStep = StepMeta & {
  run: (world: World) => Promise<StepResult>;
};

/** A Step that has run: its metadata plus what it consumed and produced. */
export type ExecutedStep = StepMeta & {
  inputs: StepValue[];
  outcome: StepOutcome;
};

/** One intent, as a person would narrate it. Expands into Steps. */
export type Action = {
  id: string;
  label: string;
  actor: Actor;
  steps: PendingStep[];
};

/** An Action's identity, kept for grouping the timeline. */
export type ActionRecord = {
  id: string;
  label: string;
  actor: Actor;
  stepIds: string[];
};

/**
 * The frozen state of the world after one Step, plus what remains to be done.
 * Snapshots are never edited — running a Step produces a new one, so rewinding
 * is a pure read of History and costs nothing.
 */
export type Snapshot = {
  index: number;
  level: Level;
  world: World;
  /** The Step that produced this Snapshot. `null` on the initial Snapshot. */
  step: ExecutedStep | null;
  /** Steps not yet run, in order. */
  queue: PendingStep[];
  actions: ActionRecord[];
};

/**
 * Eve's moves. Defined here rather than in `attacks.ts` so a Level's data can
 * name one without importing the implementation.
 */
export type AttackKind =
  | "drop"
  | "replay"
  | "tamper"
  | "compromise"
  | "substituteKey"
  /** L4: rewrite the blob sitting on the CDN, which nobody in the chat controls. */
  | "swapBlob"
  /** L5: take the backup off the provider and guess the PIN offline. */
  | "crackBackup"
  /** L6: read nothing, and describe the conversation from its shape alone. */
  | "traceTraffic";

/** A weakness a Level still carries, and the Level that answers it. */
export type Weakness = {
  id: string;
  title: string;
  detail: string;
  /** Which Level fixes this. `null` when nothing here does. */
  answeredBy: Level | null;
  /** The Attack that demonstrates it, if one is available at this Level. */
  attack?: AttackKind;
};

/**
 * Something this Level fixes, stated as the attack that used to work. The UI
 * offers the attack and lets the reader watch it fail for real — a claim the page
 * makes and then has to keep.
 */
export type Defence = {
  id: string;
  title: string;
  detail: string;
  /** The Level whose weakness this answers. */
  answers: Level;
  attack: AttackKind;
};

export type LevelInfo = {
  level: Level;
  title: string;
  summary: string;
  /** False while a Level is specified but not yet built. */
  available: boolean;
  weaknesses: Weakness[];
  /** Empty at L1: it fixes nothing, it is the baseline. */
  defences: Defence[];
  /** Which of Eve's moves this Level's engine can actually perform. */
  attacks: AttackKind[];
};
