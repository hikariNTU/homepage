/**
 * Setup Actions every Level shares: make an identity key pair, put the public
 * half on the wire, import the peer's, and do the static ECDH.
 *
 * L1 stops there and derives one message key. L2 uses the same secret to seed a
 * root key and then ratchets. L3 replaces the exchange with a prekey bundle but
 * keeps the keygen. The steps themselves are identical, so they live here rather
 * than being copied per Level.
 */

import {
  assertPacketCarriesNoPrivateMaterial,
  ecdhSharedSecret,
  exportPrivateKeyBytes,
  exportRawPublicKey,
  generateIdentityKeyPair,
  importRawPublicKey,
  PARAMS,
} from "../primitives";
import type { Action, DeviceId, Packet, PendingStep, World } from "../types";
import {
  nextId,
  peerOf,
  withDevice,
  withPacket,
  withPacketPatch,
} from "../world";

export function nameOf(device: DeviceId): string {
  return device === "alice" ? "Alice" : "Bob";
}

export function step(
  actionId: string,
  meta: Omit<PendingStep, "id" | "actionId">,
): PendingStep {
  return { ...meta, id: nextId("step"), actionId };
}

export function keygenAction(device: DeviceId): Action {
  const id = nextId(`${device}-keygen`);
  return {
    id,
    label: `${device}.generateKey()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates an identity key pair`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "An ECDH P-256 key pair. The private key stays on this device for the whole session; only the public half will ever be sent.",
        run: async (world) => {
          const pair = await generateIdentityKeyPair();
          const publicKeyRaw = await exportRawPublicKey(pair.publicKey);
          const privateKeyBytes = await exportPrivateKeyBytes(pair.privateKey);
          return {
            world: withDevice(world, device, {
              identityKeyPair: pair,
              publicKeyRaw,
              privateKeyBytes,
            }),
            inputs: [
              { label: "algorithm", text: "ECDH, curve P-256" },
              {
                label: "extractable",
                text: "true (so this page can show you the bytes)",
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "public key (raw)",
                  bytes: publicKeyRaw,
                  note: "Uncompressed point: 0x04 ‖ X ‖ Y. Public — this will travel.",
                },
                {
                  label: "private key (pkcs8)",
                  bytes: privateKeyBytes,
                  note: "Exported only so the panel can show it. Never placed in a packet.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

export function publishAction(device: DeviceId): Action {
  const id = nextId(`${device}-publish`);
  const packetId = nextId("pkt");
  return {
    id,
    label: `${device}.publishPublicKey()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} exports the public half`,
        op: "crypto.subtle.exportKey",
        crypto: "subtle",
        prose:
          "Turn the public key into bytes that can be sent. The private key is not touched.",
        run: async (world) => {
          const raw = await exportRawPublicKey(
            world[device].identityKeyPair!.publicKey,
          );
          return {
            world: withDevice(world, device, { publicKeyRaw: raw }),
            inputs: [{ label: "format", text: "raw" }],
            outcome: {
              ok: true,
              values: [{ label: "public key bytes", bytes: raw }],
            },
          };
        },
      }),
      step(id, {
        actor: "wire",
        title: `${nameOf(device)}'s public key goes on the wire`,
        op: null,
        crypto: "none",
        prose:
          "No cryptography here — bytes simply move. Everything on the wire is public, and Eve keeps a copy of all of it.",
        run: async (world) => {
          const payload = world[device].publicKeyRaw!;
          const packet: Packet = {
            id: packetId,
            from: device,
            to: peerOf(device),
            kind: "public-key",
            label: `${nameOf(device)}'s public key`,
            payload,
            status: "in-flight",
            tampered: false,
          };
          assertPacketCarriesNoPrivateMaterial(packet, world);
          return {
            world: withPacket(world, packet),
            inputs: [{ label: "payload", bytes: payload }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "packet",
                  text: `${packet.label} → ${nameOf(packet.to)}`,
                  note: "Public key material only.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

export function receiveKeyAction(device: DeviceId): Action {
  const id = nextId(`${device}-recvkey`);
  const peer = peerOf(device);
  const findKeyPacket = (world: World) => {
    const packet = world.packets.find(
      (candidate) =>
        candidate.kind === "public-key" &&
        candidate.from === peer &&
        candidate.status !== "dropped",
    );
    if (!packet) throw new Error(`[e2ee] ${peer}'s public key never arrived`);
    return packet;
  };
  return {
    id,
    label: `${device}.importPublicKey(${peer})`,
    actor: device,
    steps: [
      step(id, {
        actor: "wire",
        title: `${nameOf(peer)}'s public key arrives at ${nameOf(device)}`,
        op: null,
        crypto: "none",
        prose:
          "Delivery, not cryptography. The bytes are exactly what was sent — unless Eve changed them.",
        run: async (world) => {
          const packet = findKeyPacket(world);
          return {
            world: withPacketPatch(world, packet.id, { status: "delivered" }),
            inputs: [{ label: "packet", text: packet.label }],
            outcome: {
              ok: true,
              values: [{ label: "bytes received", bytes: packet.payload }],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports it as a public key`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "The bytes become a usable ECDH public key. Note what is missing: nothing here proves whose key it is. That is L1's third weakness.",
        run: async (world) => {
          const packet = findKeyPacket(world);
          const key = await importRawPublicKey(packet.payload);
          return {
            world: withDevice(world, device, {
              peerPublicKey: key,
              peerPublicKeyRaw: packet.payload,
            }),
            inputs: [
              { label: "raw bytes", bytes: packet.payload },
              { label: "algorithm", text: "ECDH, curve P-256" },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: `${peer} public key`,
                  text: "CryptoKey (public)",
                  note: "Unauthenticated: no signature was checked.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

export function agreeAction(device: DeviceId): Action {
  const id = nextId(`${device}-agree`);
  const peer = peerOf(device);
  return {
    id,
    label: `${device}.ecdh(${peer})`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} derives the shared secret`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "Own private key plus the peer's public key. Both devices reach the same 32 bytes, and those bytes are never sent — this is the whole trick.",
        run: async (world) => {
          const self = world[device];
          const secret = await ecdhSharedSecret(
            self.identityKeyPair!.privateKey,
            self.peerPublicKey!,
          );
          return {
            world: withDevice(world, device, { sharedSecret: secret }),
            inputs: [
              {
                label: "own private key",
                text: "CryptoKey (private)",
                note: "Never leaves this device.",
              },
              { label: `${peer} public key`, bytes: self.peerPublicKeyRaw! },
              { label: "length", text: `${PARAMS.sharedSecretBits} bits` },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "shared secret",
                  bytes: secret,
                  note: "Compare the two devices: identical, and it never crossed the wire.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}
