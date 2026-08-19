/**
 * Eve's moves. Each returns Actions whose Steps run for real — nothing about the
 * outcome is scripted. Whether an Attack succeeds is decided by the Level's
 * protocol and by the cryptography, not by this file.
 *
 * The two moves added for L2 and L3 are the interesting ones:
 *
 * - `compromise` steals whatever key material the device is holding *right now* and
 *   then opens every sealed message she has captured — one real `decrypt` per packet,
 *   so every plaintext shown was genuinely recovered. At L1 that is all of them,
 *   because the key never changed; and `eveOpenAction` keeps doing it for messages
 *   sent afterwards, since holding that key *is* reading the conversation. At L2 and
 *   L3 the key that opened each message was deleted after one use and a hash chain
 *   has no inverse, so there is nothing on the device to try.
 * - `substituteKey` rewrites one field of a prekey bundle in flight. It exists only
 *   at L3, because only L3 has a signature for it to fail against.
 */

import {
  aadFor,
  decodeFields,
  encodeFields,
  exportAesKeyBytes,
  exportRawPublicKey,
  flipByte,
  generateAesKey,
  generateIdentityKeyPair,
  nonceFor,
  openAesGcm,
  randomByteIndex,
  sealAesGcm,
  sha256,
  toHex,
  utf8,
} from "./primitives";
import { deliverAction } from "./scenarios/messaging-l1";
import { BUNDLE_SIGNED_PREKEY_FIELD } from "./scenarios/messaging-l3";
import { ratchetDeliverActions } from "./scenarios/ratchet";
import { openablePackets, sealingKeyOf } from "./exposure";
import { ATTACHMENT_LABEL } from "./scenarios/messaging-l4";
import { crackBackupAction } from "./scenarios/messaging-l5";
import { traceTrafficAction } from "./scenarios/messaging-l6";
import type {
  Action,
  AttackKind,
  Bytes,
  Level,
  Packet,
  PendingStep,
  StolenItem,
  StolenKind,
  World,
} from "./types";
import {
  deviceOf,
  findPacket,
  nextId,
  withCracked,
  withForged,
  withPacket,
  withPacketPatch,
  withStolen,
  withStorePatch,
} from "./world";

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
  from: Packet["from"],
): Action[] {
  return level === "L1"
    ? [deliverAction(packetId, to)]
    : ratchetDeliverActions(world, packetId, to, from);
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
                      : "The delivery is cancelled — and because this mission keeps no store of skipped message keys, the receiving chain now stalls where it stands.",
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
    ...deliverFor(level, world, copyId, packet.to, packet.from),
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
  const holdsMessageKey = deviceOf(world, victim).messageKeyBytes !== null;
  const ratchet = deviceOf(world, victim).ratchet;

  const inventoryStep = eveStep(id, {
    actor: "wire",
    title: `Eve takes ${victim === "alice" ? "Alice" : "Bob"}'s device`,
    op: null,
    crypto: "none",
    prose:
      "Not a network attack at all: the phone is unlocked on a table. Everything the device is holding at this instant is hers. The question is what that gets her, and the answer is entirely a property of the protocol.",
    run: async (world) => {
      const device = deviceOf(world, victim);
      // The real bytes off the real device, and they go into Eve's pile — a move
      // whose only output was a sentence was the one place on this page where an
      // attack had no visible consequence.
      const loot: StolenItem[] = [];
      const take = (
        bytes: Bytes | null,
        kind: StolenKind,
        label: string,
        format: string,
        note: string,
        /** The device's own handle for this key, where it has one. */
        key?: CryptoKey | null,
      ) => {
        if (bytes) {
          loot.push({
            id: nextId("loot"),
            kind,
            label,
            from: victim,
            bytes,
            format,
            note,
            key: key ?? undefined,
          });
        }
      };

      take(
        device.privateKeyBytes,
        "identity-private",
        "identity private key",
        "pkcs8",
        level === "L1"
          ? "The other half of every ECDH exchange this device has ever done. In this mission the session key is derived from it and nothing else, so it is the whole session."
          : "Lets her be this device from now on. It does not recover a single past message key, because those came out of the ratchet and not out of this.",
      );
      take(
        device.messageKeyBytes,
        "message-key",
        "live message key",
        "raw AES-256",
        level === "L1"
          ? "One key for the whole session, so this opens every message she has captured and every one still to come."
          : "Good for exactly one message. It was about to be deleted.",
        device.messageKey,
      );
      take(
        device.ratchet?.rootKey ?? null,
        "root-key",
        "root key",
        "32 bytes · HKDF output",
        "Steps forward on every change of direction. Holding today's tells her nothing about yesterday's.",
      );
      take(
        device.ratchet?.sendChainKey ?? null,
        "send-chain",
        "sending chain key",
        "32 bytes · HMAC key",
        "Produces the next message key and then replaces itself. Forward only — HMAC-SHA-256 has no inverse.",
      );
      take(
        device.ratchet?.recvChainKey ?? null,
        "recv-chain",
        "receiving chain key",
        "32 bytes · HMAC key",
        "Sits at a definite position in the chain. She can follow along from here until the next direction change, and cannot walk back.",
      );

      const next = withStolen(world, loot);
      const readable = openablePackets(next, level).length;

      return {
        world: next,
        inputs: [
          { label: "captured packets", text: String(world.packets.length) },
          { label: "sealed messages she can now open", text: String(readable) },
        ],
        outcome: {
          ok: true,
          values: [
            {
              label: "taken off the device",
              text:
                loot.map((item) => item.label).join(" · ") || "nothing useful",
              note: device.ratchet
                ? `Now in Eve's pile, with the real bytes. Deleted and unrecoverable: ${device.ratchet.burned.length} message key(s) — ${device.ratchet.burned.join(", ") || "none yet"}.`
                : "Now in Eve's pile, with the real bytes. One message key protects the whole session in this mission.",
            },
          ],
        },
      };
    },
  });

  const nothingToTryStep = eveStep(id, {
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
          bytes: ratchet?.recvChainKey ?? ratchet?.sendChainKey ?? undefined,
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

  // How many opens to queue is decided here, from the packets she has captured so
  // far. Anything sealed later is opened by its own `eveOpenAction`, appended to the
  // send — see `sendActionsFor`.
  const opens = holdsMessageKey && level === "L1" ? countSealed(world) : 0;

  return [
    {
      id,
      label: `eve.compromise(${victim})`,
      actor: "eve",
      steps: [inventoryStep, ...(opens === 0 ? [nothingToTryStep] : [])],
    },
    ...Array.from({ length: opens }, () => eveOpenAction()),
  ];
}

function countSealed(world: World): number {
  return world.packets.filter(
    (packet) => packet.kind === "sealed-message" && packet.status !== "dropped",
  ).length;
}

/**
 * One real `decrypt` on the oldest sealed message Eve can open and has not opened.
 *
 * The target is resolved when the Step runs rather than when it is queued, which is
 * what lets the same factory serve both cases: the pile she already had when she
 * took the phone, and each message sealed afterwards — whose Packet does not exist
 * yet at the moment the Action is built.
 */
export function eveOpenAction(): Action {
  const id = nextId("eve-open");
  return {
    id,
    label: "eve.open(next captured message)",
    actor: "eve",
    steps: [
      eveStep(id, {
        actor: "wire",
        title: "Eve opens a message with the stolen key",
        op: "crypto.subtle.decrypt",
        crypto: "subtle",
        prose:
          "The key she took off the device is the key that sealed this, because in this mission there is only one for the whole session. Nothing about this call is special — it is the same AES-GCM open the recipient performs, with the same key, and it succeeds for the same reason.",
        run: async (world) => {
          const key = sealingKeyOf(world);
          // Hard-coded Level because this Action only ever exists at L1: from L2 the
          // key that sealed a captured message is deleted, and nothing queues this.
          const packet = openablePackets(world, "L1")[0];
          if (!key || !packet) {
            return {
              world,
              inputs: [],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "nothing to open",
                    text: "no captured message is left closed",
                  },
                ],
              },
            };
          }
          const header = packet.header!;
          const inputs = [
            { label: "captured ciphertext", bytes: packet.payload },
            { label: "counter", text: String(header.counter) },
          ];
          try {
            const plaintext = await openAesGcm(
              key,
              nonceFor(header.sender, header.counter),
              aadFor(header.sender, header.counter),
              packet.payload,
            );
            const text = new TextDecoder().decode(plaintext);
            return {
              // Recorded as work she did, not as a property of the packet.
              world: withCracked(world, {
                packetId: packet.id,
                plaintext,
                text,
              }),
              inputs,
              outcome: {
                ok: true,
                values: [
                  {
                    label: "plaintext Eve now has",
                    bytes: plaintext,
                    text,
                    note: "This is what no forward secrecy costs: a key stolen today reads everything captured yesterday, and everything sent tomorrow.",
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
      }),
    ],
  };
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
            "A perfectly ordinary ECDH P-256 pair. If she can get the recipient to use its public half, she is one end of the conversation and can read everything — which is exactly what happens at Mission 01 and Mission 02, where nothing is signed.",
          run: async (world) => {
            const pair = await generateIdentityKeyPair();
            const raw = await exportRawPublicKey(pair.publicKey);
            return {
              // Kept, so the next Step swaps in *this* key. It used to generate a
              // second pair of its own, which meant the bytes on screen here were
              // never the bytes that reached the bundle.
              world: withForged(world, id, raw),
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
            // No cryptography here, which is what `crypto: "none"` claims: the
            // key was generated by the Step before and is read back out of the
            // World, not made again.
            const evesKey = world.forged[id];
            if (!evesKey) {
              return {
                world,
                inputs: [{ label: "bundle", bytes: current.payload }],
                outcome: {
                  ok: false,
                  errorName: "NoForgedKey",
                  errorMessage:
                    "Eve has not generated a key to swap in — the previous Step did not run.",
                },
              };
            }
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

/**
 * L4: rewrite the blob on the CDN.
 *
 * The one place in this whole page where Eve does not have to be on the wire at
 * all — she owns the storage, or subpoenas it, or simply works there. She encrypts
 * a file of her own under a key of her own and puts it where the real one was.
 *
 * Everything about that is valid AES-GCM. It is also the wrong bytes, and SHA-256
 * is what says so.
 */
function swapBlobAttack(world: World): Action[] {
  const found = world.store.find((entry) => entry.holder === "cdn");
  if (!found) return [];
  const object = found;
  const id = nextId("eve-swapblob");
  return [
    {
      id,
      label: `eve.swapBlob(${object.label})`,
      actor: "eve",
      steps: [
        eveStep(id, {
          actor: "eve",
          title: "Eve seals a file of her own",
          op: "crypto.subtle.encrypt",
          crypto: "subtle",
          prose:
            "A real key, a real encryption, a real GCM tag. Nothing is forged here — she is simply the one who made it, which is precisely the thing the recipient has no way to notice from the bytes alone.",
          run: async (current) => {
            const key = await generateAesKey();
            const keyBytes = await exportAesKeyBytes(key);
            // Same length as the real one, because matching the size is free and
            // a recipient who spotted a length change would have spotted the
            // wrong thing — it is the digest that catches this, not arithmetic.
            const forged = new Uint8Array(
              Math.max(object.bytes.length - 16, 1),
            ) as Bytes;
            // A PNG signature and then noise: a plausible file, not the one sent.
            forged.set([0x89, 0x50, 0x4e, 0x47], 0);
            for (let i = 4; i < forged.length; i += 1)
              forged[i] = (i * 31) % 251;
            const ciphertext = await sealAesGcm(
              key,
              nonceFor("eve", 0),
              utf8(ATTACHMENT_LABEL),
              forged,
            );
            const digest = await sha256(ciphertext);
            return {
              world: withStorePatch(current, object.id, {
                bytes: ciphertext,
                swapped: true,
                note: "Replaced by Eve. Same length, same shape, different file.",
              }),
              inputs: [
                { label: "her file", bytes: forged },
                { label: "her key", bytes: keyBytes },
              ],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "replacement blob",
                    bytes: ciphertext,
                    note: "Now sitting at the URL the pointer names.",
                  },
                  {
                    label: "its sha-256",
                    bytes: digest,
                    note: "Not the digest in the sealed message, and she cannot reach that message to change it.",
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
      // The signed prekey is the one field a signature covers, and so the only
      // swap with something to fail against.
      return substituteKeyAttack(packet, BUNDLE_SIGNED_PREKEY_FIELD);
    // The last three act on the world rather than on one packet in flight: a blob
    // on a CDN, a file at a provider, the shape of the traffic as a whole.
    case "swapBlob":
      return swapBlobAttack(world);
    case "crackBackup":
      return crackBackupAction(world);
    case "traceTraffic":
      return traceTrafficAction();
  }
}

export const ATTACK_LABELS: Record<AttackKind, string> = {
  drop: "Drop",
  replay: "Replay",
  tamper: "Flip a byte",
  compromise: "Steal the device",
  substituteKey: "Swap a key",
  swapBlob: "Swap the blob",
  crackBackup: "Crack the backup",
  traceTraffic: "Trace the traffic",
};

export const ATTACK_HINTS: Record<AttackKind, string> = {
  drop: "Stop this packet ever arriving.",
  replay: "Keep a copy and send it again later.",
  tamper: "Change one byte and let it through.",
  compromise:
    "Take the unlocked device and try it against what she already captured.",
  substituteKey: "Rewrite a key in the prekey bundle while it is in flight.",
  swapBlob:
    "Replace the file on the CDN. She hosts it; nobody in the chat does.",
  crackBackup:
    "Take the archive off the provider and guess the PIN, with nobody counting.",
  traceTraffic:
    "Decrypt nothing, and describe the conversation from its shape.",
};
