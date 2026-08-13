/**
 * What each mission actually does, as a pipeline.
 *
 * `LevelInfo` already says what a mission *fixes* and what it still gets wrong.
 * This says how it works: the phases in order, and inside each phase the calls,
 * with what goes in and what comes out. The ⓘ used to be four paragraphs that
 * were identical whichever mission was loaded except for one line of parameters,
 * which told a reader that missions differ by algorithm name rather than by
 * shape — and the shape is the whole lesson.
 *
 * Prose here is not the Steps' prose. A Step explains itself while it runs, one
 * at a time and in the middle of the story; this is the map you read before
 * starting, or when you have lost your place. Both are written by hand, and both
 * describe the same real calls — an op named here is a `crypto.subtle` call the
 * engine genuinely performs, so if one drifts from the other it is a bug in this
 * file, not a difference of opinion.
 *
 * React-free like everything else under `src/lib/e2ee/`.
 */

import type { Level } from "./types";

/** One call: what it consumes, what it is, what it produces. */
export type BriefOp = {
  inputs: string[];
  /** The call performed. `null` when this row is honest about doing no cryptography. */
  op: string | null;
  /** Algorithm and the parameters that matter, e.g. `ECDH · P-256`. */
  algo: string;
  out: string;
  note?: string;
};

/** A run of calls with one purpose, and the point in the story where it happens. */
export type BriefPhase = {
  id: string;
  title: string;
  /** Who performs it — a device, both of them, the transport, or Eve. */
  actor: string;
  /** Why this phase exists, in one sentence. */
  gist: string;
  ops: BriefOp[];
  /**
   * Set when the phase is not this mission's own work but an earlier mission's
   * pipeline reused unchanged. Rendered dimmed: it is context, not the news.
   */
  inherited?: Level;
  /** Set when the phase runs again per message rather than once per session. */
  repeats?: string;
};

/** One crossing of the wire, and what is legible on it to anyone watching. */
export type BriefHop = {
  /** `up` and `down` are a server, which is a different kind of place from a peer. */
  dir: "forward" | "back" | "up" | "down";
  label: string;
  /** Fields anyone on the wire reads. */
  clear: string[];
  /** Fields only a key opens. */
  sealed: string[];
};

export type MissionBrief = {
  /** The mission in one sentence, said as a mechanism rather than a promise. */
  premise: string;
  /** Every algorithm choice this mission makes, on one line, for a reader who only wants that. */
  params: string;
  phases: BriefPhase[];
  wire: BriefHop[];
  /** True however well the mission works — the part cryptography does not touch. */
  leaks: string[];
};

const AES = "AES-GCM · 256-bit";
const ECDH = "ECDH · P-256";

/** L1's per-message pair, reused by the wire section of every later mission. */
const SEALED_MESSAGE_HOP: BriefHop = {
  dir: "forward",
  label: "sealed message",
  clear: ["sender", "counter", "nonce", "length"],
  sealed: ["the message text"],
};

const RATCHET_PHASES: BriefPhase[] = [
  {
    id: "dh-ratchet",
    title: "DH ratchet",
    actor: "whichever device speaks next",
    gist: "A change of direction costs a fresh Diffie-Hellman, so the conversation recovers even from a device that was fully compromised a moment ago.",
    repeats: "on every change of direction",
    ops: [
      {
        inputs: ["nothing — from the CSPRNG"],
        op: "crypto.subtle.generateKey",
        algo: ECDH,
        out: "a fresh ratchet key pair",
      },
      {
        inputs: ["own new ratchet private key", "peer's ratchet public key"],
        op: "crypto.subtle.deriveBits",
        algo: ECDH,
        out: "DH output · 256 bits",
      },
      {
        inputs: ["DH output as the input key material", "old root key as salt"],
        op: "crypto.subtle.deriveBits",
        algo: "HKDF-SHA-256 · 512 bits out",
        out: "new root key ‖ new chain key",
        note: "One call, split in half: the top 32 bytes replace the root, the bottom 32 start the chain for this direction.",
      },
    ],
  },
  {
    id: "chain",
    title: "Symmetric ratchet",
    actor: "the sending or receiving device",
    gist: "One key per message, from a chain that only moves forward — this is the machinery forward secrecy is made of.",
    repeats: "once per message",
    ops: [
      {
        inputs: ["current chain key"],
        op: "crypto.subtle.importKey",
        algo: "HMAC-SHA-256",
        out: "the chain key as a signing key",
      },
      {
        inputs: ["chain key", "the constant 0x01"],
        op: "crypto.subtle.sign",
        algo: "HMAC-SHA-256",
        out: "message key · 32 bytes",
      },
      {
        inputs: ["chain key", "the constant 0x02"],
        op: "crypto.subtle.sign",
        algo: "HMAC-SHA-256",
        out: "the next chain key",
        note: "The old chain key is replaced. HMAC does not run backwards, so the chain's past is gone the moment it steps.",
      },
      {
        inputs: ["message key bytes"],
        op: "crypto.subtle.importKey",
        algo: AES,
        out: "the key this one message is sealed with",
      },
      {
        inputs: ["the used message key"],
        op: null,
        algo: "no cryptography — a deletion",
        out: "the device holds a label and no bytes",
        note: "The visible half of forward secrecy. Nothing on the device can produce that key again.",
      },
    ],
  },
];

/** The seal/open pair every mission ends its send path with. */
const SEAL_PHASE: BriefPhase = {
  id: "seal",
  title: "Seal and open",
  actor: "sender, then recipient",
  gist: "The only step that touches the message itself. Everything above exists to decide which key this call gets.",
  repeats: "once per message",
  ops: [
    {
      inputs: [
        "plaintext",
        "message key",
        "nonce · device id ‖ counter",
        "additional data · sender ‖ counter",
      ],
      op: "crypto.subtle.encrypt",
      algo: AES,
      out: "ciphertext ‖ 16-byte tag",
      note: "The header is bound in as additional data rather than encrypted, so altering a byte of it fails the tag without ever hiding it.",
    },
    {
      inputs: ["ciphertext ‖ tag", "message key", "the same nonce and AAD"],
      op: "crypto.subtle.decrypt",
      algo: AES,
      out: "plaintext — or `OperationError`",
      note: "A wrong key, a flipped byte and an altered header are one failure, not three: the tag check fails and nothing comes out.",
    },
  ],
};

const HANDSHAKE_PHASES: BriefPhase[] = [
  {
    id: "identity",
    title: "Identity",
    actor: "each device, independently",
    gist: "Every device makes one key pair. The public half is the only key material that is ever allowed onto the wire.",
    ops: [
      {
        inputs: ["nothing — from the CSPRNG"],
        op: "crypto.subtle.generateKey",
        algo: ECDH,
        out: "identity key pair",
        note: "Marked extractable purely so this page can show you the private bytes. Nothing puts them in a packet, and a structural check refuses to.",
      },
      {
        inputs: ["own public key"],
        op: "crypto.subtle.exportKey",
        algo: "raw · uncompressed point · 65 bytes",
        out: "public key bytes",
      },
    ],
  },
  {
    id: "exchange",
    title: "Exchange",
    actor: "the wire",
    gist: "Public keys cross in the clear, which is exactly what public means — and exactly the hole Mission 03 closes.",
    ops: [
      {
        inputs: ["public key bytes"],
        op: null,
        algo: "no cryptography — a transmission",
        out: "a packet Eve reads, keeps, or replaces",
      },
      {
        inputs: ["the peer's raw bytes"],
        op: "crypto.subtle.importKey",
        algo: ECDH,
        out: "the peer's public key as a `CryptoKey`",
      },
    ],
  },
  {
    id: "secret",
    title: "Shared secret",
    actor: "both devices, separately",
    gist: "Both sides compute the same 32 bytes from what they hold and what arrived. Those bytes never travel — they are the point of ECDH.",
    ops: [
      {
        inputs: ["own private key", "peer's public key"],
        op: "crypto.subtle.deriveBits",
        algo: `${ECDH} · 256 bits`,
        out: "shared secret",
        note: "Identical on both devices, and never sent. Watch the two hex values match.",
      },
      {
        inputs: ["shared secret"],
        op: "crypto.subtle.importKey",
        algo: "HKDF",
        out: "a non-extractable base key",
      },
    ],
  },
];

export const BRIEF_BY_LEVEL: Record<Level, MissionBrief> = {
  L1: {
    premise:
      "One key pair per device, one shared secret, one key for every message in the session. Everything works, nothing recovers — this is the baseline the later missions are measured against.",
    params:
      "ECDH P-256 → HKDF-SHA-256 → AES-GCM-256, 12-byte nonce, AAD binds sender + counter",
    phases: [
      ...HANDSHAKE_PHASES,
      {
        id: "message-key",
        title: "Message key",
        actor: "both devices",
        gist: "One derivation, once, for the whole session — which is what makes this mission both simple and indefensible.",
        ops: [
          {
            inputs: ["HKDF base key", "salt", "info string"],
            op: "crypto.subtle.deriveKey",
            algo: "HKDF-SHA-256",
            out: "one AES-GCM key",
            note: "Static. The same key seals message 1 and message 400, in both directions.",
          },
        ],
      },
      SEAL_PHASE,
    ],
    wire: [
      {
        dir: "forward",
        label: "alice's public key",
        clear: ["the key itself", "who sent it"],
        sealed: [],
      },
      {
        dir: "back",
        label: "bob's public key",
        clear: ["the key itself", "who sent it"],
        sealed: [],
      },
      SEALED_MESSAGE_HOP,
    ],
    leaks: [
      "Who is talking to whom, when, how often, and how long each message is.",
      "Both public keys, unsigned — nothing on the wire says they are the right ones.",
      "Nothing marks a packet as already delivered, so a copy re-sent later is accepted again.",
    ],
  },

  L2: {
    premise:
      "The same handshake, then Signal's double ratchet: a root key that steps on every change of direction, and a chain that steps on every message with the used key deleted behind it.",
    params:
      "Static ECDH P-256 to seed a root key, then Signal's double ratchet: HMAC-SHA-256 chain KDF per message, HKDF-SHA-256 root KDF per direction change, AES-GCM-256 per message key, key deleted after one use",
    phases: [
      ...HANDSHAKE_PHASES,
      {
        id: "root",
        title: "Root key",
        actor: "both devices",
        gist: "The shared secret is spent once, here, to start the ratchet — and is never used to seal anything.",
        ops: [
          {
            inputs: ["HKDF base key", "salt", "info string"],
            op: "crypto.subtle.deriveBits",
            algo: "HKDF-SHA-256 · 512 bits out",
            out: "root key ‖ the first ratchet seed",
          },
        ],
      },
      ...RATCHET_PHASES,
      SEAL_PHASE,
    ],
    wire: [
      {
        dir: "forward",
        label: "alice's public key",
        clear: ["the key itself"],
        sealed: [],
      },
      {
        dir: "back",
        label: "bob's public key",
        clear: ["the key itself"],
        sealed: [],
      },
      {
        dir: "forward",
        label: "sealed message",
        clear: [
          "sender",
          "counter",
          "the sender's current ratchet public key",
          "length",
        ],
        sealed: ["the message text"],
      },
    ],
    leaks: [
      "The same metadata as Mission 01, plus a ratchet public key per direction change — which tells a watcher exactly when the conversation changed hands.",
      "The first public keys are still unsigned. The ratchet protects a conversation and says nothing about who is in it.",
    ],
  },

  L3: {
    premise:
      "Bob publishes a signed bundle and goes offline. Alice checks the signature, folds four Diffie-Hellman outputs into one root key, and sends a message with no round trip — then Mission 02's ratchet takes over.",
    params:
      "X3DH over P-256: ECDSA-signed prekey, four ECDH deriveBits combined through HKDF-SHA-256 into the root key, then the same double ratchet as Mission 02",
    phases: [
      {
        id: "bundle",
        title: "Prekey bundle",
        actor: "bob, before anyone writes to him",
        gist: "Everything a stranger needs to start a session with someone who is asleep, published once to a server.",
        ops: [
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: "ECDSA · P-256",
            out: "identity signing key pair",
            note: "Real X3DH uses one Curve25519 key for signing and Diffie-Hellman via XEdDSA. Web Crypto cannot, so the signing key is separate here and every Step that touches it says so.",
          },
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: ECDH,
            out: "signed prekey · medium-term",
          },
          {
            inputs: ["the prekey's bytes", "identity signing key"],
            op: "crypto.subtle.sign",
            algo: "ECDSA · SHA-256",
            out: "signature over the prekey",
            note: "The one thing standing between a bundle and an impostor's bundle.",
          },
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: ECDH,
            out: "one-time prekey · used once, then gone",
          },
        ],
      },
      {
        id: "verify",
        title: "Verify",
        actor: "alice, on the bundle she fetched",
        gist: "The signature binds the prekey to the identity key. Fail it and no message is ever sealed — run the key substitution and watch that happen.",
        ops: [
          {
            inputs: ["the bundle's signing public key"],
            op: "crypto.subtle.importKey",
            algo: "ECDSA · P-256",
            out: "a verify key",
          },
          {
            inputs: ["signature", "the signed prekey's bytes", "verify key"],
            op: "crypto.subtle.verify",
            algo: "ECDSA · SHA-256",
            out: "true — or false, and the handshake stops",
          },
          {
            inputs: ["both identity keys, sorted"],
            op: "crypto.subtle.digest",
            algo: "SHA-256",
            out: "the safety number",
            note: "The only answer to a bundle that was replaced whole, signing key included — and it works by being compared out of band, by two humans.",
          },
        ],
      },
      {
        id: "x3dh",
        title: "X3DH",
        actor: "alice now, bob when he comes back",
        gist: "Four Diffie-Hellmans, each binding a different thing: her identity, his identity, neither, and a key that exists once.",
        ops: [
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: ECDH,
            out: "alice's ephemeral key pair",
          },
          {
            inputs: ["alice's identity private", "bob's signed prekey"],
            op: "crypto.subtle.deriveBits",
            algo: `${ECDH} · DH1`,
            out: "DH1",
            note: "Binds the session to Alice's long-term identity.",
          },
          {
            inputs: ["alice's ephemeral private", "bob's identity key"],
            op: "crypto.subtle.deriveBits",
            algo: `${ECDH} · DH2`,
            out: "DH2",
            note: "Binds it to Bob's, so nobody but the real Bob completes it.",
          },
          {
            inputs: ["alice's ephemeral private", "bob's signed prekey"],
            op: "crypto.subtle.deriveBits",
            algo: `${ECDH} · DH3`,
            out: "DH3",
            note: "No long-term key involved, which is what keeps this session secret if an identity key leaks later.",
          },
          {
            inputs: ["alice's ephemeral private", "bob's one-time prekey"],
            op: "crypto.subtle.deriveBits",
            algo: `${ECDH} · DH4`,
            out: "DH4",
            note: "The one-time key is destroyed after this. The same first message can never open a second session.",
          },
          {
            inputs: ["0xFF ×32 ‖ DH1 ‖ DH2 ‖ DH3 ‖ DH4"],
            op: "crypto.subtle.importKey",
            algo: "HKDF",
            out: "the input key material",
            note: "The prefix is domain separation; the order matters because both sides have to concatenate identically.",
          },
          {
            inputs: ["that material", "info string"],
            op: "crypto.subtle.deriveBits",
            algo: "HKDF-SHA-256",
            out: "root key",
            note: "Bob reaches the same bytes from the two public keys in her message header and his own private keys — the reason he never had to be online.",
          },
        ],
      },
      ...RATCHET_PHASES.map((phase) => ({
        ...phase,
        inherited: "L2" as Level,
      })),
      { ...SEAL_PHASE, inherited: "L2" as Level },
    ],
    wire: [
      {
        dir: "up",
        label: "bob's bundle, published",
        clear: [
          "identity key",
          "signing key",
          "signed prekey",
          "signature",
          "one-time prekey",
        ],
        sealed: [],
      },
      {
        dir: "down",
        label: "alice fetches it",
        clear: ["who fetched whose bundle, and when"],
        sealed: [],
      },
      {
        dir: "forward",
        label: "initial sealed message",
        clear: [
          "sender",
          "counter",
          "alice's identity and ephemeral public keys",
          "which prekey it consumed",
        ],
        sealed: ["the message text"],
      },
    ],
    leaks: [
      "Who fetched whose bundle, who wrote to whom, and when. X3DH hides what a conversation says, never that it exists.",
      "Trust on first use: a signature binds a prekey to an identity key, and nothing binds an identity key to a person.",
    ],
  },

  L4: {
    premise:
      "A file deliberately does not go through the ratchet. It gets its own random key, the ciphertext goes to an ordinary CDN, and only a pointer travels inside a sealed message.",
    params:
      "Mission 03's session, plus a per-file AES-GCM-256 key from the CSPRNG — outside the ratchet on purpose — with SHA-256 over the ciphertext as the integrity check on a blob nobody in the chat hosts",
    phases: [
      {
        id: "file-key",
        title: "File key",
        actor: "the sender",
        gist: "Look at what this key is not derived from: no chain key, no root key, nothing that moves. The ratchet's design is that keys expire, and this one is built to do the opposite.",
        ops: [
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: AES,
            out: "the media key",
            note: "Never deleted. The file has to still open the next time anyone scrolls back to this message — that is a product requirement and a permanent hole in one sentence.",
          },
        ],
      },
      {
        id: "park",
        title: "Seal and park",
        actor: "the sender, then a CDN",
        gist: "The bytes go to a server nobody in the conversation controls, and the check that they came back unaltered is computed before they leave.",
        ops: [
          {
            inputs: ["the file", "media key", "a fixed nonce"],
            op: "crypto.subtle.encrypt",
            algo: AES,
            out: "ciphertext ‖ tag",
            note: "A fixed nonce is safe here for exactly one reason: this key seals one file and is never used again.",
          },
          {
            inputs: ["the ciphertext"],
            op: "crypto.subtle.digest",
            algo: "SHA-256",
            out: "the digest",
            note: "Over the sealed bytes, not the file — so it can be checked before anything is decrypted.",
          },
          {
            inputs: ["ciphertext ‖ tag"],
            op: null,
            algo: "no cryptography — an HTTP PUT",
            out: "an object on a rented bucket",
            note: "The operator now holds these bytes, learns their size and timing, and is under no obligation to forget them.",
          },
        ],
      },
      {
        id: "pointer",
        title: "The pointer",
        actor: "the ratchet, unchanged",
        gist: "What travels in the conversation is three short fields — blob URL, media key, digest — sealed like any other message.",
        inherited: "L3",
        ops: [
          {
            inputs: ["`{ blob, key, sha256 }`", "message key"],
            op: "crypto.subtle.encrypt",
            algo: AES,
            out: "an ordinary sealed message",
            note: "Which is why the digest means something: Eve owns the CDN and the wire, and still cannot alter a value she cannot read.",
          },
        ],
      },
      {
        id: "fetch",
        title: "Fetch and open",
        actor: "the recipient",
        gist: "Check first, decrypt second. The order is the defence.",
        ops: [
          {
            inputs: ["the blob URL"],
            op: null,
            algo: "no cryptography — an HTTP GET",
            out: "whatever the CDN chose to hand over",
          },
          {
            inputs: ["the downloaded bytes"],
            op: "crypto.subtle.digest",
            algo: "SHA-256",
            out: "a digest to compare against the pointer's",
            note: "Mismatch and nothing is decrypted. Run the blob swap and watch it stop there.",
          },
          {
            inputs: ["the media key from the pointer"],
            op: "crypto.subtle.importKey",
            algo: AES,
            out: "a usable key",
          },
          {
            inputs: ["ciphertext ‖ tag", "media key", "the same nonce"],
            op: "crypto.subtle.decrypt",
            algo: AES,
            out: "the file itself",
          },
        ],
      },
    ],
    wire: [
      {
        dir: "up",
        label: "the blob, to a CDN",
        clear: ["exact size", "upload time", "who uploaded it"],
        sealed: ["the file's contents"],
      },
      {
        dir: "forward",
        label: "sealed message carrying the pointer",
        clear: ["sender", "counter", "length"],
        sealed: ["blob URL", "media key", "digest"],
      },
      {
        dir: "down",
        label: "the recipient downloads it",
        clear: ["who fetched which object, and when"],
        sealed: ["the file's contents"],
      },
    ],
    leaks: [
      "The blob's exact size and its timing. A 2 MB attachment is a photo and a 40 MB one is a video, before a byte is decrypted.",
      "The ciphertext stays on the CDN after the message is deleted — deleting a message deletes a pointer.",
      "Forwarding re-encrypts and re-uploads, so the operator holds two blobs of identical length minutes apart.",
    ],
  },

  L5: {
    premise:
      "Where end-to-end encryption actually ends for most people. The plaintext history is sealed under a key stretched from a six-digit PIN and handed to the provider.",
    params:
      "Mission 03's session, plus PBKDF2-SHA-256 at 100 000 iterations over a six-digit PIN into an AES-GCM-256 key over the plaintext archive",
    phases: [
      {
        id: "archive",
        title: "The archive",
        actor: "the device",
        gist: "The ratchet deleted the keys. It never touched the message list on the phone, because that list is what a chat app is.",
        ops: [
          {
            inputs: ["every message this device can still read"],
            op: null,
            algo: "no cryptography — a file is assembled",
            out: "the archive, in plaintext",
          },
          {
            inputs: ["six digits, chosen at random", "a random salt"],
            op: null,
            algo: "no cryptography — a PIN is chosen",
            out: "the only secret in this mission",
            note: "Never sent. A million possibilities, which is the whole problem.",
          },
        ],
      },
      {
        id: "stretch",
        title: "Stretch",
        actor: "the device",
        gist: "A key derivation function cannot add entropy that was never there. It can only make each guess cost more — for the attacker and for you, by the same factor.",
        ops: [
          {
            inputs: ["the PIN as UTF-8"],
            op: "crypto.subtle.importKey",
            algo: "PBKDF2",
            out: "base key material",
          },
          {
            inputs: ["base key", "salt", "100 000 iterations"],
            op: "crypto.subtle.deriveKey",
            algo: "PBKDF2-SHA-256",
            out: "the backup key",
            note: "The page measures how long this call takes, and Eve's attack multiplies that number by her guess count in front of you.",
          },
        ],
      },
      {
        id: "upload",
        title: "Seal and hand over",
        actor: "the device, then the provider",
        gist: "Not a copy of the wire traffic — the actual history, in one object, with a name on it.",
        ops: [
          {
            inputs: ["the archive", "backup key"],
            op: "crypto.subtle.encrypt",
            algo: AES,
            out: "the sealed archive",
          },
          {
            inputs: ["the sealed archive"],
            op: null,
            algo: "no cryptography — an upload",
            out: "an object the provider holds indefinitely",
          },
        ],
      },
      {
        id: "crack",
        title: "The guessing run",
        actor: "eve, offline",
        gist: "She does not need the wire, the device, or a single key from any earlier mission. She needs the file and a laptop.",
        ops: [
          {
            inputs: ["the object"],
            op: null,
            algo: "no cryptography — she takes it",
            out: "the sealed archive, in her hands",
          },
          {
            inputs: ["a guessed PIN", "the salt"],
            op: "crypto.subtle.deriveKey ×N",
            algo: "PBKDF2-SHA-256",
            out: "a candidate key per guess",
          },
          {
            inputs: ["the sealed archive", "each candidate key"],
            op: "crypto.subtle.decrypt",
            algo: AES,
            out: "the archive, when a guess is right",
            note: "The tag is the oracle: a wrong key throws, and the right one returns the whole history. Nothing rate-limits this, because the file is hers.",
          },
        ],
      },
    ],
    wire: [
      {
        dir: "up",
        label: "the sealed archive, to the provider",
        clear: ["size", "time", "whose account it belongs to"],
        sealed: ["every message in the history"],
      },
    ],
    leaks: [
      "A six-digit PIN is a million guesses, and no key derivation function makes that number large.",
      "The security comes from hardware outside the cryptography promising to count attempts — and from that hardware being honest.",
      "Every property the ratchet bought is bypassed rather than broken: the plaintext was on the phone the whole time.",
    ],
  },

  L6: {
    premise:
      "The contents were never the whole story. This mission takes the last plaintext field off the envelope — who sent it — and then shows what is still readable without it.",
    params:
      "Mission 03's session, plus a sealed-sender envelope: ephemeral ECDH P-256 to the recipient's identity key, HKDF-SHA-256, AES-GCM-256 over the sender name and the whole inner message",
    phases: [
      {
        id: "inner",
        title: "The inner message",
        actor: "the sender",
        gist: "Mission 03's session, unchanged. What follows wraps its output; it does not replace it.",
        inherited: "L3",
        ops: [
          {
            inputs: ["plaintext", "message key from the ratchet"],
            op: "crypto.subtle.encrypt",
            algo: AES,
            out: "a sealed message with its usual header",
          },
        ],
      },
      {
        id: "envelope",
        title: "The envelope",
        actor: "the sender",
        gist: "An ephemeral key to the recipient's identity key: the sender proves nothing and names herself only on the inside.",
        ops: [
          {
            inputs: ["nothing — from the CSPRNG"],
            op: "crypto.subtle.generateKey",
            algo: ECDH,
            out: "an ephemeral key pair, used for this one envelope",
          },
          {
            inputs: ["ephemeral private key", "the recipient's identity key"],
            op: "crypto.subtle.deriveBits",
            algo: ECDH,
            out: "the envelope secret",
          },
          {
            inputs: ["envelope secret", "info string"],
            op: "crypto.subtle.deriveKey",
            algo: "HKDF-SHA-256",
            out: "the envelope key",
          },
          {
            inputs: ["the sender's name ‖ the whole inner message"],
            op: "crypto.subtle.encrypt",
            algo: AES,
            out: "the envelope",
            note: "The sender's id is inside this, not on it. It is the only copy that travels.",
          },
        ],
      },
      {
        id: "deliver",
        title: "Delivery",
        actor: "the service",
        gist: "The routing layer is handed a destination, an ephemeral public key and a blob — and routes on all it has.",
        ops: [
          {
            inputs: ["destination", "ephemeral public key", "envelope"],
            op: null,
            algo: "no cryptography — a delivery",
            out: "bytes arriving somewhere",
            note: "Nothing forces a service to accept sealed delivery, and nothing stops it recording the connection the envelope arrived on.",
          },
        ],
      },
      {
        id: "open-envelope",
        title: "Open the envelope",
        actor: "the recipient",
        gist: "He reaches the same secret from the ephemeral public key and his own identity private key, and only then learns who wrote to him.",
        ops: [
          {
            inputs: ["the ephemeral public key off the envelope"],
            op: "crypto.subtle.importKey",
            algo: ECDH,
            out: "a usable public key",
          },
          {
            inputs: ["own identity private key", "that ephemeral public key"],
            op: "crypto.subtle.deriveBits",
            algo: ECDH,
            out: "the same envelope secret",
          },
          {
            inputs: ["envelope secret", "info string"],
            op: "crypto.subtle.deriveKey",
            algo: "HKDF-SHA-256",
            out: "the envelope key",
          },
          {
            inputs: ["the envelope", "envelope key"],
            op: "crypto.subtle.decrypt",
            algo: AES,
            out: "the sender's name ‖ the inner message",
            note: "From here it is Mission 03's receive path, exactly as before.",
          },
        ],
      },
    ],
    wire: [
      {
        dir: "forward",
        label: "the envelope",
        clear: ["destination", "an ephemeral public key", "size", "time"],
        sealed: ["who sent it", "the whole inner message, header included"],
      },
    ],
    leaks: [
      "Timing and size. Two devices, alternating, seconds apart, is a conversation whatever the header says.",
      "The recipient. Something has to route the bytes, so the destination cannot be sealed the way the origin can.",
      "Sealing the sender buys privacy from an honest operator and from a subpoena — not from a hostile one on the wire it controls.",
    ],
  },
};
