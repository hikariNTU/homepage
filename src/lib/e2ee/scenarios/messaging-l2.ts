/**
 * L2 — the double ratchet.
 *
 * The handshake is L1's: two identity key pairs, two public keys on the wire, one
 * static ECDH. What changes is everything after it. Instead of deriving one AES key
 * and keeping it, the shared secret seeds a *root key*, and from there every message
 * gets its own key from a chain that only moves forward, with a fresh ECDH whenever
 * the conversation changes direction.
 *
 * Two of L1's three weaknesses die here, and the page proves it rather than claiming
 * it: `eve.replay` now fails because the key it needs was deleted, and
 * `eve.compromise` reads nothing sent before the theft because a hash chain has no
 * inverse. See `ratchet.ts` for the calls.
 *
 * What L2 still does not have is any notion of *who* the peer is — a public key on
 * the wire is still just bytes. That is L3.
 */

import { hkdfBits, hkdfInfo, importHkdfBaseKey, PARAMS } from "../primitives";
import type { Action, DeviceId, LevelInfo } from "../types";
import { nextId, peerOf, withDevice, withRatchet } from "../world";
import {
  agreeAction,
  keygenAction,
  nameOf,
  publishAction,
  receiveKeyAction,
  step,
} from "./common";
import { ratchetSendActions } from "./ratchet";

export const MESSAGING_L2: LevelInfo = {
  level: "L2",
  title: "Double ratchet",
  summary:
    "The same ECDH handshake seeds a root key. Every message then gets its own key from an HMAC chain that only moves forward, the used key is deleted, and a fresh ECDH runs whenever the conversation changes direction.",
  available: true,
  defences: [
    {
      id: "l2-replay-dead",
      title: "Replays no longer open",
      detail:
        "Run the replay that worked at L1. The receiving chain has already moved past that counter and the message key for it was deleted after one use, so there is nothing left to decrypt with. The rejection is a missing key, not a policy.",
      answers: "L1",
      attack: "replay",
    },
    {
      id: "l2-forward-secrecy",
      title: "Forward secrecy",
      detail:
        "Steal the device now and try to open the messages Eve captured earlier. HMAC-SHA-256 cannot be run backwards, so today's chain key produces future message keys and never past ones.",
      answers: "L1",
      attack: "compromise",
    },
  ],
  weaknesses: [
    {
      id: "l2-no-identity",
      title: "No identity binding",
      detail:
        "The ratchet protects the conversation beautifully and says nothing about who is on the other end. The first public key is still unsigned, so Eve substituting her own is still unanswered here.",
      answeredBy: "L3",
      attack: "substituteKey",
    },
    {
      id: "l2-no-skipped-keys",
      title: "Skipped messages stall the chain",
      detail:
        "Real Signal stores the message keys it skipped, so messages that arrive late or out of order still open. This level deliberately does not: drop one message and the next one is refused, which makes the chain's position visible. It is a simplification, not a property of the ratchet.",
      answeredBy: null,
    },
    {
      id: "l2-metadata",
      title: "Metadata is still in the clear",
      detail:
        "Who is talking to whom, when, how often, and roughly how much — all of it is on the wire in every packet header, and no amount of ratcheting hides it. Sealed sender and mixnets are separate problems.",
      answeredBy: null,
    },
  ],
  attacks: ["tamper", "drop", "replay", "compromise"],
};

const HKDF_INFO = hkdfInfo("L2/root");

/**
 * Seed the ratchet from the static ECDH secret. The identity key pair doubles as
 * each device's first ratchet key pair, so whichever device speaks first can do a
 * genuine DH ratchet against a key the other already holds.
 */
function rootInitAction(device: DeviceId): Action {
  const id = nextId(`${device}-derive`);
  const peer = peerOf(device);
  return {
    id,
    label: `${device}.initRatchet()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the secret as HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "Same call as L1, different destination: this secret will not become a message key. It becomes the root key the ratchet starts from.",
        run: async (world) => {
          const secret = world[device].sharedSecret!;
          const baseKey = await importHkdfBaseKey(secret);
          return {
            world: withDevice(world, device, { hkdfBaseKey: baseKey }),
            inputs: [{ label: "shared secret", bytes: secret }],
            outcome: {
              ok: true,
              values: [
                { label: "HKDF base key", text: "CryptoKey (non-extractable)" },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} derives the root key`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "The root key is the ratchet's starting point and never encrypts anything itself. No sending chain exists yet, which is exactly right: the first device to speak owes a DH ratchet step, and that is what gives its first message a key nobody can predict from this secret alone.",
        run: async (world) => {
          const rootKey = await hkdfBits(
            world[device].hkdfBaseKey!,
            HKDF_INFO,
            256,
          );
          const self = world[device];
          return {
            // The identity key pair is adopted as the initial ratchet key pair —
            // bookkeeping, not a call: both devices already hold these keys.
            world: withRatchet(world, device, {
              rootKey,
              selfKeyPair: self.identityKeyPair,
              selfPublicRaw: self.publicKeyRaw,
              peerPublic: self.peerPublicKey,
              peerPublicRaw: self.peerPublicKeyRaw,
            }),
            inputs: [
              { label: "hash", text: PARAMS.hkdfHash },
              { label: "salt", bytes: PARAMS.hkdfSalt },
              { label: "info", bytes: HKDF_INFO },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "root key",
                  bytes: rootKey,
                  note: "Identical on both devices. Steps forward on every change of direction and is never used to encrypt.",
                },
                {
                  label: "initial ratchet key",
                  text: `identity key pair · peer = ${peer}'s identity key`,
                  note: "The first sender replaces its half with a fresh key pair.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/** The full L2 Script: L1's handshake, the root key, then one ratcheted message. */
export function messagingL2Script(): Action[] {
  return [
    keygenAction("alice"),
    keygenAction("bob"),
    publishAction("alice"),
    publishAction("bob"),
    receiveKeyAction("bob"),
    receiveKeyAction("alice"),
    agreeAction("alice"),
    agreeAction("bob"),
    rootInitAction("alice"),
    rootInitAction("bob"),
  ];
}

export { ratchetSendActions as messagingL2SendActions };
