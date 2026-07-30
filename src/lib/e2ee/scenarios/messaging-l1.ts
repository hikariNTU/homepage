/**
 * L1 — the simplest thing that is genuinely end-to-end encrypted, and broken in
 * three named ways.
 *
 * Static ECDH P-256 → HKDF-SHA-256 → AES-GCM-256. Both Devices hold one identity
 * key pair for the whole session, agree once, and reuse the derived key for every
 * message with a per-sender counter in the nonce.
 *
 * On purpose, and load-bearing for the page: the recipient does NOT record which
 * counters it has already accepted. That is what makes Eve's replay succeed, and
 * a replay landing is what motivates L2. Do not "fix" it here.
 */

import {
  aadFor,
  assertPacketCarriesNoPrivateMaterial,
  deriveMessageKey,
  exportAesKeyBytes,
  fromUtf8,
  hkdfInfo,
  importHkdfBaseKey,
  nonceFor,
  openAesGcm,
  PARAMS,
  sealAesGcm,
  utf8,
} from "../primitives";
import type { Action, DeviceId, LevelInfo, Packet } from "../types";
import {
  findPacket,
  nextId,
  peerOf,
  withDevice,
  withPacket,
  withPacketPatch,
} from "../world";
import {
  agreeAction,
  keygenAction,
  nameOf,
  publishAction,
  receiveKeyAction,
  step,
} from "./common";

export const MESSAGING_L1: LevelInfo = {
  level: "L1",
  title: "Static ECDH + AES-GCM",
  summary:
    "Each device makes one ECDH key pair, they exchange public keys, both derive the same secret without it ever crossing the wire, and every message is sealed with AES-GCM under a key derived from it.",
  available: true,
  weaknesses: [
    {
      id: "l1-replay",
      title: "Replays are accepted",
      detail:
        "The recipient never records which counters it has already opened, so a captured packet re-sent by Eve decrypts and is accepted a second time. Nothing about AES-GCM prevents this — freshness is the protocol's job, not the cipher's.",
      answeredBy: "L2",
      attack: "replay",
    },
    {
      id: "l1-no-fs",
      title: "No forward secrecy",
      detail:
        "One key protects every message in the session. Anyone who later obtains a device's key material can decrypt every message they captured earlier — including messages sent before the theft.",
      answeredBy: "L2",
      attack: "compromise",
    },
    {
      id: "l1-no-identity",
      title: "No identity binding",
      detail:
        "A public key on the wire is just bytes. Nothing signs it, so nothing stops Eve substituting her own and speaking to each side as the other.",
      answeredBy: "L3",
    },
  ],
  defences: [],
  // No `substituteKey` here: at L1 there is no signature to defeat, so swapping a
  // key would demonstrate nothing beyond breaking the session. It lands at L3,
  // where there is something for it to fail against.
  attacks: ["tamper", "drop", "replay", "compromise"],
};

const HKDF_INFO = hkdfInfo("L1");

function deriveAction(device: DeviceId): Action {
  const id = nextId(`${device}-derive`);
  return {
    id,
    label: `${device}.hkdf()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the secret as HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "A raw ECDH output is not a good symmetric key — it has structure. HKDF is the standard way to turn it into one, and its input key must be non-extractable.",
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
        title: `${nameOf(device)} derives the message key`,
        op: "crypto.subtle.deriveKey",
        crypto: "subtle",
        prose:
          "HKDF-SHA-256 with a fixed salt and info string yields an AES-GCM-256 key. At L1 this one key protects every message in the session — which is exactly why L1 has no forward secrecy.",
        run: async (world) => {
          const key = await deriveMessageKey(
            world[device].hkdfBaseKey!,
            HKDF_INFO,
          );
          const keyBytes = await exportAesKeyBytes(key);
          return {
            world: withDevice(world, device, {
              messageKey: key,
              messageKeyBytes: keyBytes,
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
                  label: "message key",
                  bytes: keyBytes,
                  note: "Same on both devices. Used for every message at this level.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

// —— sending and delivering ————————————————————————————————————————————————

/** The delivery half, kept separate so Eve can act while the Packet is in flight. */
export function deliverAction(packetId: string, to: DeviceId): Action {
  const id = `deliver-${packetId}`;
  return {
    id,
    label: `${to}.receive()`,
    actor: to,
    steps: [
      step(id, {
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
      step(id, {
        actor: to,
        title: `${nameOf(to)} opens it`,
        op: "crypto.subtle.decrypt",
        crypto: "subtle",
        prose:
          "AES-GCM verifies the tag before it returns any plaintext. If a single byte changed, this call throws and the recipient learns nothing.",
        run: async (world) => {
          const packet = findPacket(world, packetId);
          const recipient = world[packet.to];
          const counter = packet.header!.counter;
          const nonce = nonceFor(packet.header!.sender, counter);
          const aad = aadFor(packet.header!.sender, counter);
          const inputs = [
            { label: "ciphertext", bytes: packet.payload },
            { label: "nonce (iv)", bytes: nonce },
            { label: "additional data", bytes: aad, text: fromUtf8(aad) },
            {
              label: "message key",
              bytes: recipient.messageKeyBytes ?? undefined,
            },
          ];
          try {
            const plaintext = await openAesGcm(
              recipient.messageKey!,
              nonce,
              aad,
              packet.payload,
            );
            const text = fromUtf8(plaintext);
            // L1 records nothing about counters it has already seen. That is
            // deliberate (see the file header) — it is what lets a replay land.
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
                values: [
                  {
                    label: "plaintext",
                    bytes: plaintext,
                    text,
                    note: packet.replayOf
                      ? "Accepted a second time. L1 keeps no record of counters already opened."
                      : undefined,
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
                errorMessage:
                  err.message ||
                  "Authentication tag did not verify; no plaintext is returned.",
              },
            };
          }
        },
      }),
    ],
  };
}

/** Sealing plus handing to the Wire, then the matching delivery. */
export function sendActions(from: DeviceId, text: string): Action[] {
  const id = nextId(`${from}-send`);
  const packetId = nextId("pkt");
  const to = peerOf(from);
  const sendAction: Action = {
    id,
    label: `${from}.send(${JSON.stringify(text)})`,
    actor: from,
    steps: [
      step(id, {
        actor: from,
        title: `${nameOf(from)} seals the message`,
        op: "crypto.subtle.encrypt",
        crypto: "subtle",
        prose:
          "AES-GCM encrypts and authenticates in one pass. The nonce carries the sender's counter, and the sender and counter are also bound in as additional data — authenticated, but readable on the wire.",
        run: async (world) => {
          const self = world[from];
          const counter = self.sendCounter;
          const nonce = nonceFor(from, counter);
          const aad = aadFor(from, counter);
          const plaintext = utf8(text);
          const ciphertext = await sealAesGcm(
            self.messageKey!,
            nonce,
            aad,
            plaintext,
          );
          return {
            world: withDevice(world, from, {
              sendCounter: counter + 1,
              outbox: { packetId, ciphertext, counter },
            }),
            inputs: [
              { label: "plaintext", bytes: plaintext, text },
              {
                label: "nonce (iv)",
                bytes: nonce,
                note: "Last 4 bytes are the counter.",
              },
              { label: "additional data", bytes: aad, text: fromUtf8(aad) },
              { label: "message key", bytes: self.messageKeyBytes! },
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
      step(id, {
        actor: "wire",
        title: "The sealed message goes on the wire",
        op: null,
        crypto: "none",
        prose:
          "In flight. From here until it is delivered, Eve can drop it, keep it and re-send it later, or alter its bytes.",
        run: async (world) => {
          const outbox = world[from].outbox!;
          const packet: Packet = {
            id: outbox.packetId,
            from,
            to,
            kind: "sealed-message",
            label: `sealed message #${outbox.counter} from ${nameOf(from)}`,
            payload: outbox.ciphertext,
            header: { sender: from, counter: outbox.counter },
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
                  note: "Ciphertext and a public header. No key material.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
  return [sendAction, deliverAction(packetId, to)];
}

/** The full L1 Script: bring both Devices up, then send one message. */
export function messagingL1Script(): Action[] {
  return [
    keygenAction("alice"),
    keygenAction("bob"),
    publishAction("alice"),
    publishAction("bob"),
    receiveKeyAction("bob"),
    receiveKeyAction("alice"),
    agreeAction("alice"),
    agreeAction("bob"),
    deriveAction("alice"),
    deriveAction("bob"),
    ...sendActions("alice", "hey bob, this one is real crypto"),
  ];
}
