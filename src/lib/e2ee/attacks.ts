/**
 * Eve's moves. Each returns Actions whose Steps run for real — nothing about the
 * outcome is scripted. Whether an Attack succeeds is decided by the Level's
 * protocol and by the cryptography, not by this file.
 *
 * The two moves added for L2 and L3 are the interesting ones:
 *
 * - `compromise` steals whatever key material the device is holding *right now* and
 *   tries it against the oldest message Eve captured. At L1 that opens it, because
 *   the key never changed. At L2 and L3 the key that opened it was deleted after one
 *   use and a hash chain has no inverse, so there is nothing on the device to try.
 * - `substituteKey` rewrites one field of a prekey bundle in flight. It exists only
 *   at L3, because only L3 has a signature for it to fail against.
 */

import {
  aadFor,
  aadForHeader,
  decodeFields,
  encodeFields,
  exportRawPublicKey,
  flipByte,
  generateIdentityKeyPair,
  nonceFor,
  openAesGcm,
  randomByteIndex,
  toHex,
} from "./primitives";
import { deliverAction } from "./scenarios/messaging-l1";
import { ratchetDeliverActions } from "./scenarios/ratchet";
import type {
  Action,
  AttackKind,
  Level,
  Packet,
  PendingStep,
  World,
} from "./types";
import { findPacket, nextId, withPacket, withPacketPatch } from "./world";

export type { AttackKind } from "./types";

function eveStep(
  actionId: string,
  meta: Omit<PendingStep, "id" | "actionId">,
): PendingStep {
  return { ...meta, id: nextId("step"), actionId };
}

/** Delivery differs by Level, so a replay has to be re-queued the Level's own way. */
function deliverFor(
  level: Level,
  world: World,
  packetId: string,
  to: Packet["to"],
): Action[] {
  return level === "L1"
    ? [deliverAction(packetId, to)]
    : ratchetDeliverActions(world, packetId, to);
}

function dropAttack(packet: Packet, level: Level): Action[] {
  const id = nextId("eve-drop");
  return [
    {
      id,
      label: `eve.drop(${packet.label})`,
      actor: "eve",
      steps: [
        eveStep(id, {
          actor: "wire",
          title: "Eve drops the packet",
          op: null,
          crypto: "none",
          prose:
            "No cryptography defends against this. Encryption protects confidentiality and integrity, never availability — a network Eve controls is a network she can silence.",
          run: async (world) => ({
            world: withPacketPatch(world, packet.id, { status: "dropped" }),
            inputs: [{ label: "packet", text: packet.label }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "result",
                  text: "never delivered",
                  note:
                    level === "L1"
                      ? "The delivery that was queued for this packet will not happen."
                      : "The delivery is cancelled — and because this level keeps no store of skipped message keys, the receiving chain now stalls where it stands.",
                },
              ],
            },
            cancelActionIds: [
              `deliver-${packet.id}`,
              `receive-${packet.id}`,
              `open-${packet.id}`,
            ],
          }),
        }),
      ],
    },
  ];
}

function tamperAttack(packet: Packet): Action[] {
  const id = nextId("eve-tamper");
  const index = randomByteIndex(packet.payload.length);
  return [
    {
      id,
      label: `eve.tamper(${packet.label}, byte ${index})`,
      actor: "eve",
      steps: [
        eveStep(id, {
          actor: "wire",
          title: `Eve flips one bit of byte ${index}`,
          op: null,
          crypto: "none",
          prose:
            "Eve cannot read the message, but she can change it. Advance to the recipient's decrypt step to see what AES-GCM does about it.",
          run: async (world) => {
            const current = findPacket(world, packet.id);
            const altered = flipByte(current.payload, index);
            return {
              world: withPacketPatch(world, packet.id, {
                payload: altered,
                tampered: true,
              }),
              inputs: [
                { label: "original", bytes: current.payload },
                { label: "byte index", text: String(index) },
              ],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "altered",
                    bytes: altered,
                    note: `byte ${index}: ${toHex(current.payload.slice(index, index + 1))} → ${toHex(altered.slice(index, index + 1))}`,
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

function replayAttack(packet: Packet, level: Level, world: World): Action[] {
  const id = nextId("eve-replay");
  const copyId = nextId("pkt");
  return [
    {
      id,
      label: `eve.replay(${packet.label})`,
      actor: "eve",
      steps: [
        eveStep(id, {
          actor: "wire",
          title: "Eve re-sends a packet she kept",
          op: null,
          crypto: "none",
          prose:
            "Byte-for-byte the same packet, sent again. It is validly encrypted and validly authenticated, because it genuinely was — the only question is whether the recipient can still open it.",
          run: async (world) => {
            const source = findPacket(world, packet.id);
            const copy: Packet = {
              ...source,
              id: copyId,
              payload: source.payload.slice(),
              status: "in-flight",
              replayOf: source.id,
              label: `${source.label} (replay)`,
            };
            return {
              world: withPacket(world, copy),
              inputs: [{ label: "captured packet", bytes: source.payload }],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "re-sent packet",
                    bytes: copy.payload,
                    note: "Identical ciphertext, identical header, identical counter.",
                  },
                ],
              },
            };
          },
        }),
      ],
    },
    ...deliverFor(level, world, copyId, packet.to),
  ];
}

/**
 * Eve takes the device. Two Steps: what she finds, and one attempt on the oldest
 * sealed packet she kept. At L1 the message key is still sitting there and the
 * attempt is a real `decrypt` that returns the plaintext; from L2 the key was
 * deleted after one use, so there is nothing to call `decrypt` with — and saying
 * that plainly is more honest than staging a call that must fail.
 */
function compromiseAttack(
  level: Level,
  world: World,
  target: Packet,
): Action[] {
  const id = nextId("eve-compromise");
  const victim = target.to;
  const holdsMessageKey = world[victim].messageKeyBytes !== null;
  const ratchet = world[victim].ratchet;

  const inventoryStep = eveStep(id, {
    actor: "wire",
    title: `Eve takes ${victim === "alice" ? "Alice" : "Bob"}'s device`,
    op: null,
    crypto: "none",
    prose:
      "Not a network attack at all: the phone is unlocked on a table. Everything the device is holding at this instant is hers. The question is what that gets her, and the answer is entirely a property of the protocol.",
    run: async (world) => {
      const device = world[victim];
      const found: string[] = [];
      if (device.privateKeyBytes) found.push("identity private key");
      if (device.messageKeyBytes) found.push("a live message key");
      if (device.ratchet?.rootKey) found.push("the current root key");
      if (device.ratchet?.sendChainKey) found.push("the sending chain key");
      if (device.ratchet?.recvChainKey) found.push("the receiving chain key");
      return {
        world,
        inputs: [
          { label: "captured packets", text: String(world.packets.length) },
        ],
        outcome: {
          ok: true,
          values: [
            {
              label: "found on the device",
              text: found.join(" · ") || "nothing useful",
              note: device.ratchet
                ? `Deleted and unrecoverable: ${device.ratchet.burned.length} message key(s) — ${device.ratchet.burned.join(", ") || "none yet"}.`
                : "One message key protects the whole session at this level.",
            },
          ],
        },
      };
    },
  });

  const attemptStep = holdsMessageKey
    ? eveStep(id, {
        actor: "wire",
        title: "Eve opens the message she captured earlier",
        op: "crypto.subtle.decrypt",
        crypto: "subtle",
        prose:
          "The key on the device is the key that sealed this message, because at this level there is only one. Every message she has ever captured falls the same way — including the ones sent long before she took the phone.",
        run: async (world) => {
          const packet = findPacket(world, target.id);
          const device = world[victim];
          const header = packet.header!;
          const nonce = nonceFor(header.sender, header.counter);
          const aad =
            level === "L1"
              ? aadFor(header.sender, header.counter)
              : aadForHeader(header);
          const inputs = [
            { label: "stolen key", bytes: device.messageKeyBytes! },
            { label: "captured ciphertext", bytes: packet.payload },
          ];
          try {
            const plaintext = await openAesGcm(
              device.messageKey!,
              nonce,
              aad,
              packet.payload,
            );
            return {
              world,
              inputs,
              outcome: {
                ok: true,
                values: [
                  {
                    label: "plaintext Eve now has",
                    bytes: plaintext,
                    text: new TextDecoder().decode(plaintext),
                    note: "This is what no forward secrecy costs: a key stolen today reads everything captured yesterday.",
                  },
                ],
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
                errorMessage: err.message,
              },
            };
          }
        },
      })
    : eveStep(id, {
        actor: "wire",
        title: "Eve has nothing that opens the message she captured",
        op: null,
        crypto: "none",
        prose:
          "There is no call to make. The message key that sealed this packet was deleted the moment it was used, and the chain key on the device only runs forward — HMAC-SHA-256 has no inverse, so no amount of computing produces the previous chain key. Her captured ciphertext stays closed.",
        run: async (world) => ({
          world,
          inputs: [
            { label: "captured ciphertext", bytes: target.payload },
            {
              label: "chain key on device",
              bytes:
                ratchet?.recvChainKey ?? ratchet?.sendChainKey ?? undefined,
              note: "Produces future message keys only.",
            },
          ],
          outcome: {
            ok: false,
            errorName: "NoKeyForThisMessage",
            errorMessage: `The message key for counter ${target.header?.counter ?? 0} no longer exists on this device. It was used once and deleted, and the chain it came from cannot be rewound. Messages Eve captures from now on are a different question — she holds a live chain key, so until the next change of direction she can follow along.`,
          },
        }),
      });

  return [
    {
      id,
      label: `eve.compromise(${victim})`,
      actor: "eve",
      steps: [inventoryStep, attemptStep],
    },
  ];
}

/**
 * Eve rewrites the signed prekey in a bundle still in flight and leaves the
 * signature alone. L3's verify Step is what decides whether that matters.
 */
function substituteKeyAttack(packet: Packet, fieldIndex: number): Action[] {
  const id = nextId("eve-substitute");
  return [
    {
      id,
      label: `eve.substituteKey(${packet.label})`,
      actor: "eve",
      steps: [
        eveStep(id, {
          actor: "wire",
          title: "Eve generates a key pair of her own",
          op: "crypto.subtle.generateKey",
          crypto: "subtle",
          prose:
            "A perfectly ordinary ECDH P-256 pair. If she can get the recipient to use its public half, she is one end of the conversation and can read everything — which is exactly what happens at L1 and L2, where nothing is signed.",
          run: async (world) => {
            const pair = await generateIdentityKeyPair();
            const raw = await exportRawPublicKey(pair.publicKey);
            return {
              world,
              inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "Eve's public key",
                    bytes: raw,
                    note: "About to be written into the bundle in place of the real prekey.",
                  },
                ],
              },
            };
          },
        }),
        eveStep(id, {
          actor: "wire",
          title: "Eve swaps her key into the bundle",
          op: null,
          crypto: "none",
          prose:
            "She overwrites one field of the bundle and leaves the signature untouched, because she cannot produce a signature over her key with an identity key she does not hold. Advance to the recipient's verify step.",
          run: async (world) => {
            const current = findPacket(world, packet.id);
            const fields = decodeFields(current.payload, 5);
            if (!fields) {
              return {
                world,
                inputs: [{ label: "bundle", bytes: current.payload }],
                outcome: {
                  ok: false,
                  errorName: "MalformedBundle",
                  errorMessage:
                    "This packet is not a well-formed prekey bundle, so there is no field to swap.",
                },
              };
            }
            const pair = await generateIdentityKeyPair();
            const evesKey = await exportRawPublicKey(pair.publicKey);
            const before = fields[fieldIndex];
            fields[fieldIndex] = evesKey;
            const altered = encodeFields(fields);
            return {
              world: withPacketPatch(world, packet.id, {
                payload: altered,
                tampered: true,
              }),
              inputs: [
                { label: "field replaced", bytes: before },
                {
                  label: "signature",
                  bytes: fields[3],
                  note: "Left as it was.",
                },
              ],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "bundle Eve is forwarding",
                    bytes: altered,
                    note: "The prekey no longer matches the signature that came with it.",
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

/** Build the Actions for one Attack, as that Level performs it. */
export function attackActions(
  level: Level,
  kind: AttackKind,
  packet: Packet,
  world: World,
): Action[] {
  switch (kind) {
    case "drop":
      return dropAttack(packet, level);
    case "tamper":
      return tamperAttack(packet);
    case "replay":
      return replayAttack(packet, level, world);
    case "compromise":
      return compromiseAttack(level, world, packet);
    case "substituteKey":
      // Field 2 of the bundle is the signed prekey: the one field a signature
      // covers, and so the only swap with something to fail against.
      return substituteKeyAttack(packet, 2);
  }
}

export const ATTACK_LABELS: Record<AttackKind, string> = {
  drop: "Drop",
  replay: "Replay",
  tamper: "Flip a byte",
  compromise: "Steal the device",
  substituteKey: "Swap a key",
};

export const ATTACK_HINTS: Record<AttackKind, string> = {
  drop: "Stop this packet ever arriving.",
  replay: "Keep a copy and send it again later.",
  tamper: "Change one byte and let it through.",
  compromise:
    "Take the unlocked device and try it against what she already captured.",
  substituteKey: "Rewrite a key in the prekey bundle while it is in flight.",
};
