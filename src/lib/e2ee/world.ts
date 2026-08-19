/**
 * World construction and the small immutable-update helpers the Scripts use.
 *
 * Nothing here mutates: every helper returns a new object, which is what makes
 * rewinding History a pure read.
 */

import { RESERVED_ACTOR_IDS } from "./types";
import type {
  Bytes,
  CrackedMessage,
  DeviceId,
  DeviceState,
  Level,
  MediaState,
  Packet,
  PrekeyState,
  RatchetState,
  SealState,
  StolenItem,
  StoredObject,
  VaultState,
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

export function emptyMedia(): MediaState {
  return {
    key: null,
    keyBytes: null,
    plaintext: null,
    ciphertext: null,
    digest: null,
    objectId: null,
    digestMatched: null,
  };
}

export function emptyVault(): VaultState {
  return {
    pin: null,
    salt: null,
    archiveBytes: null,
    sealedArchive: null,
    backupKey: null,
    backupKeyBytes: null,
    objectId: null,
  };
}

export function emptySeal(): SealState {
  return {
    ephemeralKeyPair: null,
    ephemeralPublicRaw: null,
    envelopeKey: null,
    envelopeKeyBytes: null,
    revealedSender: null,
  };
}

/**
 * Which Levels give a device which sub-state. Kept as one table rather than a
 * chain of ternaries: it is the only place that says what a Level is made of, and
 * L4 upward are all "L3 plus one more idea".
 */
const RATCHET_LEVELS: Level[] = ["L2", "L3", "L4", "L5", "L6"];
const PREKEY_LEVELS: Level[] = ["L3", "L4", "L5", "L6"];

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
    ratchet: RATCHET_LEVELS.includes(level) ? emptyRatchet() : null,
    prekeys: PREKEY_LEVELS.includes(level) ? emptyPrekeys() : null,
    media: level === "L4" ? emptyMedia() : null,
    vault: level === "L5" ? emptyVault() : null,
    seal: level === "L6" ? emptySeal() : null,
    sendCounter: 0,
    outbox: null,
    inbox: [],
    sentLog: [],
  };
}

/** The two devices every `messaging` Level starts with. */
export const ALICE: DeviceId = "alice";
export const BOB: DeviceId = "bob";

export function initialWorld(
  level: Level,
  ids: DeviceId[] = [ALICE, BOB],
): World {
  assertDeviceIdsAreDistinct(ids);
  const devices: Record<DeviceId, DeviceState> = {};
  for (const id of ids) devices[id] = emptyDevice(id, level);
  return freezeWorld({
    devices,
    deviceOrder: [...ids],
    packets: [],
    stolen: [],
    cracked: [],
    store: [],
    forged: {},
  });
}

/**
 * Ids have to stay distinct in their first 8 bytes, because that prefix is the
 * sender tag inside every AES-GCM nonce (see `nonceFor`). Two devices sharing a
 * prefix would reuse a nonce under the same key, which is the one mistake AES-GCM
 * does not survive — so it is checked rather than documented and hoped for.
 */
function assertDeviceIdsAreDistinct(ids: DeviceId[]): void {
  const reserved = ids.filter((id) => RESERVED_ACTOR_IDS.includes(id));
  if (reserved.length > 0) {
    throw new Error(
      `[e2ee] reserved actor id used as a device: ${reserved.join(", ")}`,
    );
  }
  const tags = new Set(ids.map((id) => id.slice(0, 8)));
  if (tags.size !== ids.length) {
    throw new Error(
      `[e2ee] device ids must differ within their first 8 characters: ${ids.join(", ")}`,
    );
  }
}

/**
 * Shallow-freeze the world and the objects it owns. Typed arrays are left alone
 * on purpose — `Object.freeze` throws on array buffer views with elements — and
 * they are never written to after construction anyway.
 */
function freezeWorld(world: World): World {
  for (const device of Object.values(world.devices)) Object.freeze(device);
  Object.freeze(world.devices);
  Object.freeze(world.deviceOrder);
  Object.freeze(world.packets);
  Object.freeze(world.store);
  return Object.freeze(world);
}

/** One device, by id. Throws rather than returning undefined: an unknown id is a bug. */
export function deviceOf(world: World, id: DeviceId): DeviceState {
  const device = world.devices[id];
  if (!device) throw new Error(`[e2ee] no device ${id} in this world`);
  return device;
}

export function withDevice(
  world: World,
  id: DeviceId,
  patch: Partial<DeviceState>,
): World {
  return freezeWorld({
    ...world,
    devices: { ...world.devices, [id]: { ...deviceOf(world, id), ...patch } },
  });
}

/** Patch one Device's ratchet, which every L2/L3 Step does and nothing else touches. */
export function withRatchet(
  world: World,
  id: DeviceId,
  patch: Partial<RatchetState>,
): World {
  const current = deviceOf(world, id).ratchet;
  if (!current) throw new Error(`[e2ee] ${id} has no ratchet at this level`);
  return withDevice(world, id, { ratchet: { ...current, ...patch } });
}

export function withMedia(
  world: World,
  id: DeviceId,
  patch: Partial<MediaState>,
): World {
  const current = deviceOf(world, id).media;
  if (!current)
    throw new Error(`[e2ee] ${id} has no media state at this level`);
  return withDevice(world, id, { media: { ...current, ...patch } });
}

export function withVault(
  world: World,
  id: DeviceId,
  patch: Partial<VaultState>,
): World {
  const current = deviceOf(world, id).vault;
  if (!current) throw new Error(`[e2ee] ${id} has no vault at this level`);
  return withDevice(world, id, { vault: { ...current, ...patch } });
}

export function withSeal(
  world: World,
  id: DeviceId,
  patch: Partial<SealState>,
): World {
  const current = deviceOf(world, id).seal;
  if (!current) throw new Error(`[e2ee] ${id} has no seal state at this level`);
  return withDevice(world, id, { seal: { ...current, ...patch } });
}

/** Remember a public key Eve made, so the Step that uses it uses that one. */
export function withForged(world: World, id: string, bytes: Bytes): World {
  return freezeWorld({
    ...world,
    forged: { ...world.forged, [id]: bytes },
  });
}

/** Park bytes on a server. Nothing removes them — that is the point of the field. */
export function withStored(world: World, object: StoredObject): World {
  return freezeWorld({ ...world, store: [...world.store, object] });
}

export function withStorePatch(
  world: World,
  objectId: string,
  patch: Partial<StoredObject>,
): World {
  return freezeWorld({
    ...world,
    store: world.store.map((object) =>
      object.id === objectId ? { ...object, ...patch } : object,
    ),
  });
}

export function findStored(world: World, objectId: string): StoredObject {
  const object = world.store.find((candidate) => candidate.id === objectId);
  if (!object) throw new Error(`[e2ee] no object ${objectId} in the store`);
  return object;
}

export function withPrekeys(
  world: World,
  id: DeviceId,
  patch: Partial<PrekeyState>,
): World {
  const current = deviceOf(world, id).prekeys;
  if (!current) throw new Error(`[e2ee] ${id} has no prekeys at this level`);
  return withDevice(world, id, { prekeys: { ...current, ...patch } });
}

/** Add to Eve's stolen pile. Append-only: she never gives anything back. */
export function withStolen(world: World, items: StolenItem[]): World {
  return freezeWorld({ ...world, stolen: [...world.stolen, ...items] });
}

/** Record a Packet Eve opened. Append-only for the same reason. */
export function withCracked(world: World, entry: CrackedMessage): World {
  return freezeWorld({ ...world, cracked: [...world.cracked, entry] });
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
