/**
 * World construction and the small immutable-update helpers the Scripts use.
 *
 * Nothing here mutates: every helper returns a new object, which is what makes
 * rewinding History a pure read.
 */

import type {
  DeviceId,
  DeviceState,
  Level,
  Packet,
  PrekeyState,
  RatchetState,
  World,
} from "./types";

export function emptyRatchet(): RatchetState {
  return {
    selfKeyPair: null,
    selfPublicRaw: null,
    peerPublic: null,
    peerPublicRaw: null,
    rootKey: null,
    sendChainKey: null,
    recvChainKey: null,
    sendCount: 0,
    recvCount: 0,
    chainHmacKey: null,
    burned: [],
  };
}

export function emptyPrekeys(): PrekeyState {
  return {
    signingKeyPair: null,
    signingPublicRaw: null,
    signedPreKeyPair: null,
    signedPreKeyPublicRaw: null,
    signedPreKeySignature: null,
    oneTimePreKeyPair: null,
    oneTimePreKeyPublicRaw: null,
    oneTimePreKeyUsed: false,
    ephemeralKeyPair: null,
    ephemeralPublicRaw: null,
    dhOutputs: [],
    peerBundle: null,
    peerVerifyKey: null,
    signatureVerified: null,
    safetyNumber: null,
  };
}

function emptyDevice(id: DeviceId, level: Level): DeviceState {
  return {
    id,
    identityKeyPair: null,
    publicKeyRaw: null,
    privateKeyBytes: null,
    peerPublicKey: null,
    peerPublicKeyRaw: null,
    sharedSecret: null,
    hkdfBaseKey: null,
    messageKey: null,
    messageKeyBytes: null,
    ratchet: level === "L1" ? null : emptyRatchet(),
    prekeys: level === "L3" ? emptyPrekeys() : null,
    sendCounter: 0,
    outbox: null,
    inbox: [],
  };
}

export function initialWorld(level: Level): World {
  return freezeWorld({
    alice: emptyDevice("alice", level),
    bob: emptyDevice("bob", level),
    packets: [],
  });
}

/**
 * Shallow-freeze the world and the objects it owns. Typed arrays are left alone
 * on purpose — `Object.freeze` throws on array buffer views with elements — and
 * they are never written to after construction anyway.
 */
function freezeWorld(world: World): World {
  Object.freeze(world.alice);
  Object.freeze(world.bob);
  Object.freeze(world.packets);
  return Object.freeze(world);
}

export function peerOf(id: DeviceId): DeviceId {
  return id === "alice" ? "bob" : "alice";
}

export function withDevice(
  world: World,
  id: DeviceId,
  patch: Partial<DeviceState>,
): World {
  return freezeWorld({
    ...world,
    [id]: { ...world[id], ...patch },
  });
}

/** Patch one Device's ratchet, which every L2/L3 Step does and nothing else touches. */
export function withRatchet(
  world: World,
  id: DeviceId,
  patch: Partial<RatchetState>,
): World {
  const current = world[id].ratchet;
  if (!current) throw new Error(`[e2ee] ${id} has no ratchet at this level`);
  return withDevice(world, id, { ratchet: { ...current, ...patch } });
}

export function withPrekeys(
  world: World,
  id: DeviceId,
  patch: Partial<PrekeyState>,
): World {
  const current = world[id].prekeys;
  if (!current) throw new Error(`[e2ee] ${id} has no prekeys at this level`);
  return withDevice(world, id, { prekeys: { ...current, ...patch } });
}

export function withPacket(world: World, packet: Packet): World {
  return freezeWorld({ ...world, packets: [...world.packets, packet] });
}

export function withPacketPatch(
  world: World,
  packetId: string,
  patch: Partial<Packet>,
): World {
  return freezeWorld({
    ...world,
    packets: world.packets.map((packet) =>
      packet.id === packetId ? { ...packet, ...patch } : packet,
    ),
  });
}

export function findPacket(world: World, packetId: string): Packet {
  const packet = world.packets.find((candidate) => candidate.id === packetId);
  if (!packet) throw new Error(`[e2ee] no packet ${packetId} on the wire`);
  return packet;
}

let sequence = 0;

/** Ids only need to be unique within a session; they are never persisted. */
export function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}
