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

/** A depth rung within one Scenario. Higher Levels answer weaknesses of lower ones. */
export type Level = "L1" | "L2" | "L3";

export type DeviceId = "alice" | "bob";

/** Who performed a Step. `wire` covers transport and Eve's meddling. */
export type Actor = DeviceId | "wire";

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

export type PacketKind = "public-key" | "prekey-bundle" | "sealed-message";

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
  /** Counter for messages this Device has sent; feeds the nonce and the AAD. */
  sendCounter: number;
  /** A message sealed but not yet handed to the Wire. */
  outbox: { packetId: string; ciphertext: Bytes; counter: number } | null;
  inbox: InboxEntry[];
};

/** Everything that exists at one instant. Replaced wholesale by each Step. */
export type World = {
  alice: DeviceState;
  bob: DeviceState;
  packets: Packet[];
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
  actor: DeviceId | "eve";
  steps: PendingStep[];
};

/** An Action's identity, kept for grouping the timeline. */
export type ActionRecord = {
  id: string;
  label: string;
  actor: DeviceId | "eve";
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
  | "substituteKey";

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
