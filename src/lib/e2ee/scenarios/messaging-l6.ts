/**
 * L6 — sealed sender.
 *
 * Every Level so far has protected the contents and left the envelope alone. Look
 * at what a sealed message still says on the outside: who sent it, who it is for,
 * when, and how many. A service that never decrypts a single byte can still draw
 * the social graph, and for most of the people who need this page most, the graph
 * *is* the sensitive part.
 *
 * Sealed sender takes one field off the outside. The sender's name goes inside a
 * second envelope, encrypted with an ephemeral Diffie-Hellman to the recipient's
 * identity key, so the delivery service can route on the destination and learns
 * nothing about the origin. Signal ships this.
 *
 * What it does not do — and the Level says so rather than letting the reader
 * assume it — is make anyone anonymous. Bytes still leave one place and arrive at
 * another, at a time, at a size. `eve.traceTraffic` reads nothing and reconstructs
 * the conversation anyway.
 */

import {
  decodeFields,
  ecdhSharedSecret,
  encodeFields,
  exportAesKeyBytes,
  exportRawPublicKey,
  fromUtf8,
  generateIdentityKeyPair,
  hkdfInfo,
  importHkdfBaseKey,
  importRawPublicKey,
  deriveMessageKey,
  nonceFor,
  openAesGcm,
  sealAesGcm,
  utf8,
} from "../primitives";
import type { Action, Bytes, DeviceId, LevelInfo, World } from "../types";
import {
  ALICE,
  BOB,
  deviceOf,
  findPacket,
  nextId,
  withPacketPatch,
  withSeal,
} from "../world";
import { nameOf, step } from "./common";
import {
  firstMessageOptions,
  responderX3dhAction,
  x3dhScript,
} from "./messaging-l3";
import { ratchetSendActions } from "./ratchet";

export const MESSAGING_L6: LevelInfo = {
  level: "L6",
  title: "Sealed sender",
  summary:
    "The contents were never the whole story. This mission takes the last plaintext field off the envelope — who sent it — by encrypting the sender's identity to a key only the recipient holds, and then shows what is still readable without it.",
  available: true,
  defences: [
    {
      id: "l6-sender-sealed",
      title: "The sender is off the envelope",
      detail:
        "The delivery service is handed a destination, an ephemeral public key, and a blob. Run the trace: Eve can still count and time and measure, and the one thing she cannot do any more is read a name off a packet she did not open.",
      answers: "L3",
      attack: "traceTraffic",
    },
  ],
  weaknesses: [
    {
      id: "l6-traffic-shape",
      title: "Timing and size still talk",
      detail:
        "Nobody's name is on the envelope, and it still leaves one place at one moment and arrives at another. Two devices, alternating, seconds apart, is a conversation whatever the header says. Sealing the sender is not anonymity, and no amount of it ever becomes anonymity.",
      answeredBy: null,
      attack: "traceTraffic",
    },
    {
      id: "l6-delivery-still-known",
      title: "The recipient is still in the clear",
      detail:
        "Something has to route the bytes, so the destination cannot be sealed the way the origin can. Real deployments push the recipient behind a delivery token and an access key; the service still ends up knowing which mailbox it dropped this in.",
      answeredBy: null,
    },
    {
      id: "l6-trust-the-server",
      title: "Nothing forces the service to be sealed",
      detail:
        "A client asks for sealed delivery; a server that would rather have the metadata can decline, or simply record the connection the envelope arrived on. This buys privacy from an honest operator and from a subpoena, not from a hostile one on the wire it controls.",
      answeredBy: null,
    },
  ],
  attacks: [
    "tamper",
    "drop",
    "replay",
    "compromise",
    "substituteKey",
    "traceTraffic",
  ],
};

const L6_FIRST_MESSAGE = "no name on the outside of this one";
const ENVELOPE_INFO = hkdfInfo("L6/sealed-sender");
const ENVELOPE_AAD = utf8("e2ee-visualiser/sealed-sender/v1");
const ENVELOPE_FIELDS = 2;

/** The envelope's own nonce. One key, one envelope, so a fixed nonce is safe. */
const ENVELOPE_NONCE = nonceFor("envelope", 0);

/**
 * The peer's identity public key, from wherever this device came to hold it.
 *
 * The initiator fetched a bundle; the responder read the key out of the first
 * message's header. Both are the same fact, arrived at differently, and an
 * envelope can be sealed in either direction — so the lookup covers both rather
 * than assuming the sender is the one who started the conversation.
 */
function peerIdentityRawOf(world: World, device: DeviceId): Bytes {
  const self = deviceOf(world, device);
  const raw =
    self.prekeys?.peerBundle?.identityPublicRaw ?? self.peerPublicKeyRaw;
  if (!raw)
    throw new Error(`[e2ee] ${device} does not hold the peer's identity key`);
  return raw;
}

/**
 * Wrap a message that is already on the wire.
 *
 * Six Steps, all real, and none of them touch the inner ciphertext — the message
 * was sealed by the ratchet and stays sealed. This is a second layer whose only
 * job is to hide a name.
 */
function sealSenderAction(
  from: DeviceId,
  to: DeviceId,
  packetId: string,
): Action {
  const id = nextId(`${from}-sealsender`);
  return {
    id,
    label: `${from}.sealSender()`,
    actor: from,
    steps: [
      step(id, {
        actor: from,
        title: `${nameOf(from)} generates an ephemeral key pair`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "Fresh for this one envelope, and discarded after. Its public half is the only thing about the sender that will travel — and a random point on a curve names nobody.",
        run: async (world) => {
          const pair = await generateIdentityKeyPair();
          const ephemeralPublicRaw = await exportRawPublicKey(pair.publicKey);
          return {
            world: withSeal(world, from, {
              ephemeralKeyPair: pair,
              ephemeralPublicRaw,
            }),
            inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "ephemeral public key",
                  bytes: ephemeralPublicRaw,
                  note: "Unlinkable to the last one, and to the next one.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: from,
        title: `${nameOf(from)} imports ${nameOf(to)}'s identity key`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "From the prekey bundle she already verified at Mission 03. The envelope goes to his long-term identity key rather than a ratchet key, because the delivery service has to be able to hand it to him whenever he next appears.",
        run: async (world) => {
          const identityRaw = peerIdentityRawOf(world, from);
          await importRawPublicKey(identityRaw);
          return {
            world,
            inputs: [{ label: "raw bytes", bytes: identityRaw }],
            outcome: {
              ok: true,
              values: [
                { label: `${to} identity key`, text: "CryptoKey (public)" },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: from,
        title: `${nameOf(from)} derives the envelope secret`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "Ephemeral private against his identity public. He will reach the same bytes from the other side using the ephemeral public key the service is about to carry for him — which is the entire trick, run one more time for one more purpose.",
        run: async (world) => {
          const seal = deviceOf(world, from).seal!;
          const identityRaw = peerIdentityRawOf(world, from);
          const peerKey = await importRawPublicKey(identityRaw);
          const secret = await ecdhSharedSecret(
            seal.ephemeralKeyPair!.privateKey,
            peerKey,
          );
          return {
            world: withSeal(world, from, { envelopeKeyBytes: secret }),
            inputs: [
              { label: "ephemeral private key", text: "CryptoKey (private)" },
              { label: `${to} identity key`, bytes: identityRaw },
            ],
            outcome: {
              ok: true,
              values: [{ label: "envelope secret", bytes: secret }],
            },
          };
        },
      }),
      step(id, {
        actor: from,
        title: `${nameOf(from)} imports it as HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "A raw curve point is not a key. The same import that seeded every other secret on this page.",
        run: async (world) => {
          const seal = deviceOf(world, from).seal!;
          await importHkdfBaseKey(seal.envelopeKeyBytes!);
          return {
            world,
            inputs: [
              { label: "envelope secret", bytes: seal.envelopeKeyBytes! },
            ],
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
        actor: from,
        title: `${nameOf(from)} derives the envelope key`,
        op: "crypto.subtle.deriveKey",
        crypto: "subtle",
        prose:
          "AES-GCM-256, for one envelope. It is not part of the ratchet and never becomes part of it — sealing the sender is a separate concern from protecting the conversation, and mixing them would give the metadata layer a way to hurt the message layer.",
        run: async (world) => {
          const seal = deviceOf(world, from).seal!;
          const baseKey = await importHkdfBaseKey(seal.envelopeKeyBytes!);
          const envelopeKey = await deriveMessageKey(baseKey, ENVELOPE_INFO);
          const envelopeKeyBytes = await exportAesKeyBytes(envelopeKey);
          return {
            world: withSeal(world, from, { envelopeKey, envelopeKeyBytes }),
            inputs: [{ label: "info", bytes: ENVELOPE_INFO }],
            outcome: {
              ok: true,
              values: [{ label: "envelope key", bytes: envelopeKeyBytes }],
            },
          };
        },
      }),
      step(id, {
        actor: from,
        title: `${nameOf(from)} seals her name inside the envelope`,
        op: "crypto.subtle.encrypt",
        crypto: "subtle",
        prose:
          "The sender's name and the whole inner message, encrypted together. Compare the packet before and after this Step: the header that said who this was from is gone, and what remains is a destination, a random public key, and bytes.",
        run: async (world) => {
          const seal = deviceOf(world, from).seal!;
          const packet = findPacket(world, packetId);
          const inner = encodeFields([utf8(from), packet.payload]);
          const envelope = await sealAesGcm(
            seal.envelopeKey!,
            ENVELOPE_NONCE,
            ENVELOPE_AAD,
            inner,
          );
          return {
            world: withPacketPatch(world, packetId, {
              kind: "sealed-envelope",
              label: `sealed envelope → ${nameOf(to)}`,
              hidesSender: true,
              envelope,
              envelopeEphemeralRaw: seal.ephemeralPublicRaw!,
            }),
            inputs: [
              { label: "sender", text: from, bytes: utf8(from) },
              { label: "inner message", bytes: packet.payload },
              { label: "envelope key", bytes: seal.envelopeKeyBytes! },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "envelope",
                  bytes: envelope,
                  note: "What the delivery service is handed. It can route this and it cannot attribute it.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/** The mirror: the recipient does the same Diffie-Hellman and reads the name. */
function openEnvelopeAction(to: DeviceId, packetId: string): Action {
  const id = nextId(`${to}-openenvelope`);
  return {
    id,
    label: `${to}.openEnvelope()`,
    actor: to,
    steps: [
      step(id, {
        actor: to,
        title: `${nameOf(to)} imports the ephemeral public key`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "Carried in the clear beside the envelope, because it has to be. It identifies nobody — that is what makes it safe to send in the open.",
        run: async (world) => {
          const packet = findPacket(world, packetId);
          await importRawPublicKey(packet.envelopeEphemeralRaw!);
          return {
            world,
            inputs: [
              { label: "raw bytes", bytes: packet.envelopeEphemeralRaw! },
            ],
            outcome: {
              ok: true,
              values: [
                { label: "ephemeral public key", text: "CryptoKey (public)" },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: to,
        title: `${nameOf(to)} derives the same envelope secret`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "His identity private key against the ephemeral public key. Nobody else on the network holds the private half of an identity key, which is why nobody else can do this — including the service carrying it.",
        run: async (world) => {
          const packet = findPacket(world, packetId);
          const ephemeral = await importRawPublicKey(
            packet.envelopeEphemeralRaw!,
          );
          const secret = await ecdhSharedSecret(
            deviceOf(world, to).identityKeyPair!.privateKey,
            ephemeral,
          );
          return {
            world: withSeal(world, to, { envelopeKeyBytes: secret }),
            inputs: [
              {
                label: "own identity private key",
                text: "CryptoKey (private)",
              },
              {
                label: "ephemeral public key",
                bytes: packet.envelopeEphemeralRaw!,
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "envelope secret",
                  bytes: secret,
                  note: "Compare with the sender's. Identical, and it never travelled.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: to,
        title: `${nameOf(to)} imports it as HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose: "The same import on the same bytes, so the same key comes out.",
        run: async (world) => {
          const seal = deviceOf(world, to).seal!;
          await importHkdfBaseKey(seal.envelopeKeyBytes!);
          return {
            world,
            inputs: [
              { label: "envelope secret", bytes: seal.envelopeKeyBytes! },
            ],
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
        actor: to,
        title: `${nameOf(to)} derives the envelope key`,
        op: "crypto.subtle.deriveKey",
        crypto: "subtle",
        prose: "Same info string, same salt, same 32 bytes out.",
        run: async (world) => {
          const seal = deviceOf(world, to).seal!;
          const baseKey = await importHkdfBaseKey(seal.envelopeKeyBytes!);
          const envelopeKey = await deriveMessageKey(baseKey, ENVELOPE_INFO);
          const envelopeKeyBytes = await exportAesKeyBytes(envelopeKey);
          return {
            world: withSeal(world, to, { envelopeKey, envelopeKeyBytes }),
            inputs: [{ label: "info", bytes: ENVELOPE_INFO }],
            outcome: {
              ok: true,
              values: [{ label: "envelope key", bytes: envelopeKeyBytes }],
            },
          };
        },
      }),
      step(id, {
        actor: to,
        title: `${nameOf(to)} opens the envelope and learns who sent it`,
        op: "crypto.subtle.decrypt",
        crypto: "subtle",
        prose:
          "The name comes out here, on the recipient's device, and nowhere earlier. Everything the delivery service handled was a destination and a blob — and note the ordering: he finds out who it is from *after* he has already proved he can open it.",
        run: async (world) => {
          const seal = deviceOf(world, to).seal!;
          const packet = findPacket(world, packetId);
          const inner = await openAesGcm(
            seal.envelopeKey!,
            ENVELOPE_NONCE,
            ENVELOPE_AAD,
            packet.envelope!,
          );
          const fields = decodeFields(inner, ENVELOPE_FIELDS);
          if (!fields) {
            return {
              world,
              inputs: [{ label: "envelope", bytes: packet.envelope! }],
              outcome: {
                ok: false,
                errorName: "MalformedEnvelope",
                errorMessage: "the envelope decrypted but did not parse",
              },
            };
          }
          const [senderBytes, ciphertext] = fields;
          const sender = fromUtf8(senderBytes);
          return {
            world: withSeal(world, to, { revealedSender: sender }),
            inputs: [
              { label: "envelope", bytes: packet.envelope! },
              { label: "envelope key", bytes: seal.envelopeKeyBytes! },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "sender",
                  text: sender,
                  note: "Recovered, not routed. The service never held this.",
                },
                {
                  label: "inner message",
                  bytes: ciphertext,
                  note: "Byte-identical to what the ratchet sealed. This layer never touched it.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/**
 * Eve's move at L6: read nothing at all, and describe the conversation anyway.
 *
 * Not one `crypto.subtle` call, because she needs none. Everything below is read
 * off the shape of the traffic: destinations, sizes, and the order things moved
 * in — the fields sealing the sender does not touch and cannot.
 */
export function traceTrafficAction(): Action[] {
  const id = nextId("eve-trace");
  return [
    {
      id,
      label: "eve.traceTraffic()",
      actor: "eve",
      steps: [
        step(id, {
          actor: "eve",
          title: "Eve reads the shape of the traffic",
          op: null,
          crypto: "none",
          prose:
            "No key, no decrypt, no attempt at one. She counts packets, measures them, and notes which way they went. Sealed sender removed a name; it did not remove the fact that something happened.",
          run: async (current) => {
            const moved = current.packets.filter(
              (packet) => packet.status !== "dropped",
            );
            const lines = moved.map((packet, index) => {
              const size = (packet.envelope ?? packet.payload).length;
              return `${String(index + 1).padStart(2, "0")}  → ${packet.to}  ${String(size).padStart(4, " ")} B  ${packet.hidesSender ? "sender sealed" : packet.kind}`;
            });
            const destinations = new Set(moved.map((packet) => packet.to));
            const summary = [
              `${moved.length} objects moved between ${destinations.size} endpoints.`,
              `Largest ${Math.max(...moved.map((p) => (p.envelope ?? p.payload).length))} B, smallest ${Math.min(...moved.map((p) => (p.envelope ?? p.payload).length))} B.`,
              "Alternating destinations, seconds apart, sizes consistent with typed sentences. That is a conversation between two people, and its participants are the two endpoints — one of which is on every packet.",
            ].join(" ");
            return {
              world: current,
              inputs: [
                {
                  label: "available to her",
                  text: "destination, byte count, arrival order",
                  note: "Everything a router needs, which is the problem: a router needs quite a lot.",
                },
              ],
              outcome: {
                ok: true,
                values: [
                  { label: "traffic log", text: lines.join("\n") },
                  {
                    label: "conclusion",
                    text: summary,
                    note: "Nothing here was decrypted. Nothing here needed to be.",
                  },
                ],
              },
            };
          },
        }),
      ],
    },
  ];
}

/**
 * An L6 send: the ratchet's work, then the envelope around it, then the recipient
 * unwrapping before he can do anything else.
 */
export function messagingL6SendActions(
  world: World,
  from: DeviceId,
  to: DeviceId,
  text: string,
  options: { firstMessage?: boolean } = {},
): Action[] {
  const first = options.firstMessage
    ? firstMessageOptions(from, to)
    : { extraHeader: undefined, beforeDelivery: undefined };

  return ratchetSendActions(world, from, to, text, {
    extraHeader: first.extraHeader,
    beforeDelivery: (packetId) => [
      sealSenderAction(from, to, packetId),
      openEnvelopeAction(to, packetId),
      // X3DH catch-up comes after the unwrap on purpose: the keys it needs are in
      // the header, and at L6 the header was inside the envelope.
      ...(options.firstMessage
        ? [responderX3dhAction(to, from, packetId)]
        : []),
    ],
  });
}

export function messagingL6Script(world: World): Action[] {
  return x3dhScript(world, (current) =>
    messagingL6SendActions(current, ALICE, BOB, L6_FIRST_MESSAGE, {
      firstMessage: true,
    }),
  );
}
