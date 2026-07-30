/**
 * The double ratchet, as the messaging half of L2 and L3.
 *
 * Two chains that only ever move forward:
 *
 * - The **symmetric chain**. A chain key is an HMAC key. `HMAC(CK, 0x01)` is the
 *   message key, `HMAC(CK, 0x02)` is the next chain key, and the old chain key is
 *   then gone. SHA-256 does not run backwards, so a device holding today's chain
 *   key cannot reconstruct yesterday's message key. That is forward secrecy, and
 *   it is why `eve.compromise` reads nothing old here.
 * - The **DH ratchet**. Whenever the direction of conversation changes, the sender
 *   makes a fresh ratchet key pair, does ECDH against the peer's current ratchet
 *   key, and runs the root KDF. That is what recovers security after a compromise:
 *   Eve's stolen chain key stops working at the next direction change.
 *
 * Both KDFs are the ones Signal specifies, not stand-ins. Every Step below is one
 * real `crypto.subtle` call or one honest admission that no cryptography happened.
 *
 * A used message key is deleted the moment the AES-GCM call returns. That is the
 * one thing an L1 reader is asked to look at: the replay that landed at L1 now has
 * nothing left to open it, and that is a genuine failure, not a rejection message.
 */

import {
  aadForHeader,
  assertPacketCarriesNoPrivateMaterial,
  CHAIN_MESSAGE_INFO,
  CHAIN_NEXT_INFO,
  ecdhSharedSecret,
  exportRawPublicKey,
  fromUtf8,
  generateIdentityKeyPair,
  hmac,
  importAesKey,
  importChainKey,
  importHkdfBaseKey,
  importRawPublicKey,
  nonceFor,
  openAesGcm,
  rootRatchetBits,
  sealAesGcm,
  splitRootKdf,
  toHex,
  utf8,
} from "../primitives";
import type {
  Action,
  DeviceId,
  Packet,
  PacketHeader,
  PendingStep,
  World,
} from "../types";
import {
  findPacket,
  nextId,
  peerOf,
  withDevice,
  withPacket,
  withPacketPatch,
  withRatchet,
} from "../world";
import { nameOf, step } from "./common";

function ratchetOf(world: World, device: DeviceId) {
  const ratchet = world[device].ratchet;
  if (!ratchet) throw new Error(`[e2ee] ${device} has no ratchet`);
  return ratchet;
}

// —— the DH ratchet ————————————————————————————————————————————————————————

/**
 * Four Steps: a fresh ratchet key pair, one ECDH, the HKDF import, and the root
 * KDF. Queued only when the direction of conversation has changed.
 */
function dhRatchetSteps(device: DeviceId, actionId: string): PendingStep[] {
  const peer = peerOf(device);
  return [
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} makes a fresh ratchet key pair`,
      op: "crypto.subtle.generateKey",
      crypto: "subtle",
      prose:
        "The direction of the conversation just changed, so a brand new ECDH key pair is generated for this leg of it. The old one is discarded — anyone who steals the device from here on cannot use it.",
      run: async (world) => {
        const pair = await generateIdentityKeyPair();
        const raw = await exportRawPublicKey(pair.publicKey);
        return {
          world: withRatchet(world, device, {
            selfKeyPair: pair,
            selfPublicRaw: raw,
          }),
          inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
          outcome: {
            ok: true,
            values: [
              {
                label: "ratchet public key",
                bytes: raw,
                note: "Travels in the clear in every message header on this chain.",
              },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} does ECDH against ${nameOf(peer)}'s ratchet key`,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose:
        "New private ratchet key against the peer's current public ratchet key. This output is what makes the next root key unpredictable to anyone holding only the old one.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const output = await ecdhSharedSecret(
          ratchet.selfKeyPair!.privateKey,
          ratchet.peerPublic!,
        );
        return {
          world: withDevice(world, device, { sharedSecret: output }),
          inputs: [
            { label: "own ratchet private key", text: "CryptoKey (private)" },
            {
              label: `${peer} ratchet public key`,
              bytes: ratchet.peerPublicRaw!,
            },
          ],
          outcome: {
            ok: true,
            values: [{ label: "DH output", bytes: output }],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} imports the DH output as HKDF input`,
      op: "crypto.subtle.importKey",
      crypto: "subtle",
      prose:
        "The root KDF is HKDF-SHA-256, and HKDF input key material has to be a non-extractable CryptoKey.",
      run: async (world) => {
        const output = world[device].sharedSecret!;
        const baseKey = await importHkdfBaseKey(output);
        return {
          world: withDevice(world, device, { hkdfBaseKey: baseKey }),
          inputs: [{ label: "DH output", bytes: output }],
          outcome: {
            ok: true,
            values: [
              { label: "HKDF base key", text: "CryptoKey (non-extractable)" },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} steps the root key forward`,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose:
        "HKDF with the old root key as salt and the fresh DH output as input material, 512 bits out: the next root key, and the sending chain key for this leg. Exactly Signal's KDF_RK.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const bits = await rootRatchetBits(
          world[device].hkdfBaseKey!,
          ratchet.rootKey,
        );
        const { rootKey, chainKey } = splitRootKdf(bits);
        return {
          world: withRatchet(world, device, {
            rootKey,
            sendChainKey: chainKey,
            sendCount: 0,
          }),
          inputs: [
            {
              label: "salt (old root key)",
              bytes: ratchet.rootKey ?? undefined,
              text: ratchet.rootKey
                ? undefined
                : "32 zero bytes (first ratchet)",
            },
            { label: "output length", text: "512 bits" },
          ],
          outcome: {
            ok: true,
            values: [
              {
                label: "new root key",
                bytes: rootKey,
                note: "Replaces the old one. The old root key is not kept.",
              },
              {
                label: "sending chain key",
                bytes: chainKey,
                note: "Message keys for this leg of the conversation come from here.",
              },
            ],
          },
        };
      },
    }),
  ];
}

/** The receiving mirror: import the header's ratchet key, then the same three Steps. */
function recvRatchetSteps(
  device: DeviceId,
  actionId: string,
  packetId: string,
): PendingStep[] {
  const peer = peerOf(device);
  return [
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} imports the ratchet key from the header`,
      op: "crypto.subtle.importKey",
      crypto: "subtle",
      prose:
        "The header carries a ratchet public key this device has not seen before, which is how it knows a DH ratchet step is due.",
      run: async (world) => {
        const packet = findPacket(world, packetId);
        const raw = packet.header!.ratchetPublicRaw!;
        const key = await importRawPublicKey(raw);
        return {
          world: withRatchet(world, device, {
            peerPublic: key,
            peerPublicRaw: raw,
          }),
          inputs: [{ label: "header ratchet key", bytes: raw }],
          outcome: {
            ok: true,
            values: [
              { label: `${peer} ratchet key`, text: "CryptoKey (public)" },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} does ECDH against it`,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose:
        "Own current ratchet private key against the sender's new ratchet public key. Both sides compute the same output, as ever, without it being sent.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const output = await ecdhSharedSecret(
          ratchet.selfKeyPair!.privateKey,
          ratchet.peerPublic!,
        );
        return {
          world: withDevice(world, device, { sharedSecret: output }),
          inputs: [
            { label: "own ratchet private key", text: "CryptoKey (private)" },
            {
              label: `${peer} ratchet public key`,
              bytes: ratchet.peerPublicRaw!,
            },
          ],
          outcome: {
            ok: true,
            values: [{ label: "DH output", bytes: output }],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} imports the DH output as HKDF input`,
      op: "crypto.subtle.importKey",
      crypto: "subtle",
      prose: "Same as on the sending side: HKDF needs a CryptoKey.",
      run: async (world) => {
        const output = world[device].sharedSecret!;
        const baseKey = await importHkdfBaseKey(output);
        return {
          world: withDevice(world, device, { hkdfBaseKey: baseKey }),
          inputs: [{ label: "DH output", bytes: output }],
          outcome: {
            ok: true,
            values: [{ label: "HKDF base key", text: "CryptoKey" }],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} steps the root key forward`,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose:
        "The same root KDF the sender ran, so both devices arrive at the same root key and the same chain key — one calls it a sending chain, the other a receiving chain.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const bits = await rootRatchetBits(
          world[device].hkdfBaseKey!,
          ratchet.rootKey,
        );
        const { rootKey, chainKey } = splitRootKdf(bits);
        return {
          // The sending chain is cleared on purpose: the next message this device
          // sends is a change of direction, so it must ratchet again first.
          world: withRatchet(world, device, {
            rootKey,
            recvChainKey: chainKey,
            recvCount: 0,
            sendChainKey: null,
          }),
          inputs: [
            {
              label: "salt (old root key)",
              bytes: ratchet.rootKey ?? undefined,
              text: ratchet.rootKey
                ? undefined
                : "32 zero bytes (first ratchet)",
            },
          ],
          outcome: {
            ok: true,
            values: [
              { label: "new root key", bytes: rootKey },
              {
                label: "receiving chain key",
                bytes: chainKey,
                note: "Identical to the sender's sending chain key.",
              },
            ],
          },
        };
      },
    }),
  ];
}

// —— the symmetric chain ————————————————————————————————————————————————————

/**
 * Four Steps that turn one chain key into one message key and the next chain key.
 * `which` picks the chain; the calls are the same either way.
 */
function chainSteps(
  device: DeviceId,
  actionId: string,
  which: "send" | "recv",
): PendingStep[] {
  const field = which === "send" ? "sendChainKey" : "recvChainKey";
  const countField = which === "send" ? "sendCount" : "recvCount";
  const label = which === "send" ? "sending" : "receiving";

  return [
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} imports the ${label} chain key as an HMAC key`,
      op: "crypto.subtle.importKey",
      crypto: "subtle",
      prose:
        "A chain key is an HMAC-SHA-256 key and nothing else. Non-extractable, because the next two calls are the only things allowed to use it.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const chainKey = ratchet[field];
        if (!chainKey) {
          return {
            world,
            inputs: [],
            outcome: {
              ok: false,
              errorName: "ChainKeyGone",
              errorMessage: `There is no ${label} chain key on this device. It was consumed and deleted, and a hash chain cannot be run backwards.`,
            },
          };
        }
        const key = await importChainKey(chainKey);
        return {
          world: withRatchet(world, device, { chainHmacKey: key }),
          inputs: [{ label: `${label} chain key`, bytes: chainKey }],
          outcome: {
            ok: true,
            values: [
              { label: "HMAC key", text: "CryptoKey (non-extractable)" },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} derives the message key`,
      op: "crypto.subtle.sign",
      crypto: "subtle",
      prose:
        "HMAC(chain key, 0x01) — Signal's KDF_CK. One message key, for one message, used once.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const keyBytes = await hmac(ratchet.chainHmacKey!, CHAIN_MESSAGE_INFO);
        return {
          world: withDevice(world, device, { messageKeyBytes: keyBytes }),
          inputs: [
            { label: "HMAC key", text: "the chain key" },
            { label: "message", bytes: CHAIN_MESSAGE_INFO, text: "0x01" },
          ],
          outcome: {
            ok: true,
            values: [
              {
                label: `message key #${ratchet[countField]}`,
                bytes: keyBytes,
                note: "Will be deleted immediately after one AES-GCM call.",
              },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} steps the ${label} chain forward`,
      op: "crypto.subtle.sign",
      crypto: "subtle",
      prose:
        "HMAC(chain key, 0x02) is the next chain key, and the old one is then dropped. Nothing on this device can produce the previous chain key again — SHA-256 has no inverse.",
      run: async (world) => {
        const ratchet = ratchetOf(world, device);
        const previous = ratchet[field]!;
        const nextChainKey = await hmac(ratchet.chainHmacKey!, CHAIN_NEXT_INFO);
        return {
          world: withRatchet(world, device, {
            [field]: nextChainKey,
            [countField]: ratchet[countField] + 1,
            chainHmacKey: null,
          }),
          inputs: [
            { label: "old chain key", bytes: previous },
            { label: "message", bytes: CHAIN_NEXT_INFO, text: "0x02" },
          ],
          outcome: {
            ok: true,
            values: [
              {
                label: "next chain key",
                bytes: nextChainKey,
                note: "The old chain key is gone from this device.",
              },
            ],
          },
        };
      },
    }),
    step(actionId, {
      actor: device,
      title: `${nameOf(device)} imports the message key for AES-GCM`,
      op: "crypto.subtle.importKey",
      crypto: "subtle",
      prose: "32 bytes of HMAC output, imported as an AES-GCM-256 key.",
      run: async (world) => {
        const keyBytes = world[device].messageKeyBytes!;
        const key = await importAesKey(keyBytes);
        return {
          world: withDevice(world, device, { messageKey: key }),
          inputs: [{ label: "raw key", bytes: keyBytes }],
          outcome: {
            ok: true,
            values: [{ label: "AES-GCM key", text: "CryptoKey" }],
          },
        };
      },
    }),
  ];
}

/** Deleting the used message key, as its own Step, because it is the lesson. */
function burnStep(
  device: DeviceId,
  actionId: string,
  which: "send" | "recv",
): PendingStep {
  return step(actionId, {
    actor: device,
    title: `${nameOf(device)} deletes the message key`,
    op: null,
    crypto: "none",
    prose:
      "No cryptography — a deletion. The key that just protected this message is removed from the device. Steal the device a second later and this message is not readable; that is what forward secrecy means in practice.",
    run: async (world) => {
      const ratchet = ratchetOf(world, device);
      const position = which === "send" ? ratchet.sendCount : ratchet.recvCount;
      const label = `${which === "send" ? "sent" : "read"} #${Math.max(0, position - 1)}`;
      const bytes = world[device].messageKeyBytes;
      return {
        world: withDevice(
          withRatchet(world, device, { burned: [...ratchet.burned, label] }),
          device,
          { messageKey: null, messageKeyBytes: null },
        ),
        inputs: [{ label: "key being deleted", bytes: bytes ?? undefined }],
        outcome: {
          ok: true,
          values: [
            {
              label: "device now holds",
              text: "chain key only",
              note: "The chain key can produce future message keys, never past ones.",
            },
          ],
        },
      };
    },
  });
}

// —— send and deliver ——————————————————————————————————————————————————————

/**
 * Whether the sender owes a DH ratchet step. Decided when the Action is queued,
 * from the world as it stands then; if the state moves underneath it the chain Step
 * says so rather than guessing.
 */
function needsDhRatchet(world: World, from: DeviceId): boolean {
  return ratchetOf(world, from).sendChainKey === null;
}

export type SendOptions = {
  /**
   * Extra public header fields, resolved from the world when the Step runs — the
   * keys they name may not exist yet when the Action is built. L3's very first
   * message carries the initiator's identity and ephemeral public keys here,
   * because they are what lets a recipient who was offline for the whole handshake
   * reconstruct the secret.
   */
  extraHeader?: (world: World) => Partial<PacketHeader>;
  /**
   * Actions to run after the message is on the wire but before it is delivered,
   * given the id of the Packet they will read. L3 uses this for the recipient's
   * half of X3DH: he cannot ratchet until he has derived the root key, and he
   * cannot derive it until her message exists.
   */
  beforeDelivery?: (packetId: string) => Action[];
};

export function ratchetSendActions(
  world: World,
  from: DeviceId,
  text: string,
  options: SendOptions = {},
): Action[] {
  const to = peerOf(from);
  const packetId = nextId("pkt");
  const actions: Action[] = [];

  if (needsDhRatchet(world, from)) {
    const ratchetId = nextId(`${from}-dhratchet`);
    actions.push({
      id: ratchetId,
      label: `${from}.dhRatchet()`,
      actor: from,
      steps: dhRatchetSteps(from, ratchetId),
    });
  }

  const sendId = nextId(`${from}-send`);
  actions.push({
    id: sendId,
    label: `${from}.send(${JSON.stringify(text)})`,
    actor: from,
    steps: [
      ...chainSteps(from, sendId, "send"),
      step(sendId, {
        actor: from,
        title: `${nameOf(from)} seals the message`,
        op: "crypto.subtle.encrypt",
        crypto: "subtle",
        prose:
          "AES-GCM under a key that will never be used again. The header — sender, counter, ratchet public key — travels in the clear but is bound in as additional data, so altering any of it fails the tag.",
        run: async (world) => {
          const self = world[from];
          const ratchet = ratchetOf(world, from);
          const counter = ratchet.sendCount - 1;
          const header: PacketHeader = {
            sender: from,
            counter,
            ratchetPublicRaw: ratchet.selfPublicRaw!,
            ...options.extraHeader?.(world),
          };
          const nonce = nonceFor(from, counter);
          const aad = aadForHeader(header);
          const plaintext = utf8(text);
          const ciphertext = await sealAesGcm(
            self.messageKey!,
            nonce,
            aad,
            plaintext,
          );
          return {
            world: withDevice(world, from, {
              sendCounter: self.sendCounter + 1,
              outbox: { packetId, ciphertext, counter },
            }),
            inputs: [
              { label: "plaintext", bytes: plaintext, text },
              { label: "message key", bytes: self.messageKeyBytes! },
              { label: "nonce (iv)", bytes: nonce },
              { label: "additional data", bytes: aad, text: fromUtf8(aad) },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "ciphertext ‖ tag",
                  bytes: ciphertext,
                  note: "The last 16 bytes are the GCM authentication tag.",
                },
              ],
            },
          };
        },
      }),
      burnStep(from, sendId, "send"),
      step(sendId, {
        actor: "wire",
        title: "The sealed message goes on the wire",
        op: null,
        crypto: "none",
        prose:
          "In flight, with its public header. Eve can drop it, alter it, or keep it and send it again later — the difference from L1 is what happens when she does.",
        run: async (world) => {
          const outbox = world[from].outbox!;
          const ratchet = ratchetOf(world, from);
          const packet: Packet = {
            id: outbox.packetId,
            from,
            to,
            kind: "sealed-message",
            label: `sealed message #${outbox.counter} from ${nameOf(from)}`,
            payload: outbox.ciphertext,
            header: {
              sender: from,
              counter: outbox.counter,
              ratchetPublicRaw: ratchet.selfPublicRaw!,
              ...options.extraHeader?.(world),
            },
            status: "in-flight",
            tampered: false,
          };
          assertPacketCarriesNoPrivateMaterial(packet, world);
          return {
            world: withPacket(
              withDevice(world, from, { outbox: null }),
              packet,
            ),
            inputs: [{ label: "payload", bytes: packet.payload }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "packet",
                  text: `${packet.label} → ${nameOf(to)}`,
                  note: "Ciphertext, a counter, and a ratchet public key. No secret key material.",
                },
              ],
            },
          };
        },
      }),
    ],
  });

  if (options.beforeDelivery) actions.push(...options.beforeDelivery(packetId));
  actions.push(...ratchetDeliverActions(world, packetId, to));
  return actions;
}

/**
 * Arrival, the freshness check, the ratchet work the header calls for, and then
 * opening it. Split into two Actions so a rejected header can cancel the decrypt
 * rather than the decrypt having to fail a second time for the same reason.
 */
export function ratchetDeliverActions(
  world: World,
  packetId: string,
  to: DeviceId,
): Action[] {
  const receiveId = `receive-${packetId}`;
  const openId = `open-${packetId}`;
  const ratchet = ratchetOf(world, to);

  // Whether a DH ratchet is due is a property of the header, which already exists
  // for a replay and does not for a message still being composed. Unknown means
  // "assume one is due": the Step itself re-checks and skips nothing silently.
  const packet = world.packets.find((candidate) => candidate.id === packetId);
  const headerKey = packet?.header?.ratchetPublicRaw;
  const dhDue = headerKey
    ? toHex(headerKey) !== toHex(ratchet.peerPublicRaw ?? new Uint8Array(0))
    : true;

  return [
    {
      id: receiveId,
      label: `${to}.receive()`,
      actor: to,
      steps: [
        step(receiveId, {
          actor: "wire",
          title: `The sealed message arrives at ${nameOf(to)}`,
          op: null,
          crypto: "none",
          prose:
            "Bytes move. Whether they are the bytes that were sent depends on what Eve did while they were in flight.",
          run: async (world) => {
            const packet = findPacket(world, packetId);
            return {
              world: withPacketPatch(world, packetId, { status: "delivered" }),
              inputs: [{ label: "packet", text: packet.label }],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "ciphertext received",
                    bytes: packet.payload,
                    note: packet.tampered
                      ? "Eve altered these bytes."
                      : undefined,
                  },
                ],
              },
            };
          },
        }),
        step(receiveId, {
          actor: to,
          title: `${nameOf(to)} checks the counter against the receiving chain`,
          op: null,
          crypto: "none",
          prose:
            "The receiving chain is at a definite position. A message whose counter is behind it cannot be opened, because the key for that position was deleted after it was used — this is the check L1 does not have, and it is why a replay stops here.",
          run: async (world) => {
            const packet = findPacket(world, packetId);
            const ratchet = ratchetOf(world, to);
            const counter = packet.header!.counter;
            const headerKey = packet.header!.ratchetPublicRaw!;
            const sameChain =
              toHex(headerKey) ===
              toHex(ratchet.peerPublicRaw ?? new Uint8Array(0));
            const expected = sameChain ? ratchet.recvCount : 0;
            const inputs = [
              { label: "header counter", text: String(counter) },
              {
                label: "receiving chain position",
                text: sameChain
                  ? String(ratchet.recvCount)
                  : "0 (new chain — this header starts one)",
              },
            ];

            if (counter < expected) {
              return {
                world,
                inputs,
                outcome: {
                  ok: false,
                  errorName: "ReplayRejected",
                  errorMessage: `Counter ${counter} is behind the receiving chain, which is at ${expected}. The message key for position ${counter} was deleted the moment it was used, and a hash chain cannot be rewound to produce it again. Nothing here can open this packet.`,
                },
                cancelActionIds: [receiveId, openId],
              };
            }
            if (counter > expected) {
              return {
                world,
                inputs,
                outcome: {
                  ok: false,
                  errorName: "SkippedMessage",
                  errorMessage: `Counter ${counter} is ahead of the receiving chain, which is at ${expected}. Real Signal stores the message keys it skipped so late and out-of-order messages still open; this level deliberately does not, so a dropped message stalls the chain.`,
                },
                cancelActionIds: [receiveId, openId],
              };
            }
            return {
              world,
              inputs,
              outcome: {
                ok: true,
                values: [
                  {
                    label: "verdict",
                    text: "fresh",
                    note: "First time this position on the chain has been claimed.",
                  },
                ],
              },
            };
          },
        }),
        ...(dhDue ? recvRatchetSteps(to, receiveId, packetId) : []),
        ...chainSteps(to, receiveId, "recv"),
      ],
    },
    {
      id: openId,
      label: `${to}.open()`,
      actor: to,
      steps: [
        step(openId, {
          actor: to,
          title: `${nameOf(to)} opens it`,
          op: "crypto.subtle.decrypt",
          crypto: "subtle",
          prose:
            "AES-GCM verifies the tag over both the ciphertext and the header before it returns any plaintext. One altered byte anywhere and this call throws.",
          run: async (world) => {
            const packet = findPacket(world, packetId);
            const recipient = world[packet.to];
            const header = packet.header!;
            const counter = header.counter;
            const nonce = nonceFor(header.sender, counter);
            const aad = aadForHeader(header);
            const inputs = [
              { label: "ciphertext", bytes: packet.payload },
              {
                label: "message key",
                bytes: recipient.messageKeyBytes ?? undefined,
              },
              { label: "nonce (iv)", bytes: nonce },
              { label: "additional data", bytes: aad, text: fromUtf8(aad) },
            ];
            try {
              const plaintext = await openAesGcm(
                recipient.messageKey!,
                nonce,
                aad,
                packet.payload,
              );
              const text = fromUtf8(plaintext);
              return {
                world: withDevice(world, packet.to, {
                  inbox: [
                    ...recipient.inbox,
                    {
                      packetId,
                      from: packet.from,
                      counter,
                      text,
                      wasReplay: Boolean(packet.replayOf),
                    },
                  ],
                }),
                inputs,
                outcome: {
                  ok: true,
                  values: [{ label: "plaintext", bytes: plaintext, text }],
                },
              };
            } catch (error) {
              const err = error as Error;
              return {
                world,
                inputs,
                outcome: {
                  ok: false,
                  errorName: err.name || "Error",
                  errorMessage:
                    err.message ||
                    "Authentication tag did not verify; no plaintext is returned.",
                },
              };
            }
          },
        }),
        burnStep(to, openId, "recv"),
      ],
    },
  ];
}
