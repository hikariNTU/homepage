/**
 * What one Step changed, worked out by comparing two Snapshots' worlds.
 *
 * Because nothing is ever mutated in place, an unchanged field is still the very
 * same object, so reference equality is all this needs — no deep comparison and
 * no per-Step bookkeeping to keep in sync with what the Steps actually do.
 */

import type { DeviceState, World } from "./types";

/** Dotted field paths (`"alice.sharedSecret"`) and Packet ids that changed. */
export type ChangeSet = {
  fields: ReadonlySet<string>;
  packets: ReadonlySet<string>;
};

export const NO_CHANGES: ChangeSet = {
  fields: new Set<string>(),
  packets: new Set<string>(),
};

const WATCHED = [
  "publicKeyRaw",
  "privateKeyBytes",
  "peerPublicKeyRaw",
  "sharedSecret",
  "messageKeyBytes",
  "sendCounter",
  "inbox",
] as const satisfies readonly (keyof DeviceState)[];

/**
 * Ratchet and prekey fields are watched individually rather than as whole objects:
 * the objects are replaced on every patch, so comparing them would mark every slot
 * as changed on every Step.
 */
const WATCHED_RATCHET = [
  "rootKey",
  "sendChainKey",
  "recvChainKey",
  "selfPublicRaw",
  "peerPublicRaw",
  "burned",
] as const;

const WATCHED_PREKEYS = [
  "signingPublicRaw",
  "signedPreKeyPublicRaw",
  "signedPreKeySignature",
  "oneTimePreKeyPublicRaw",
  "ephemeralPublicRaw",
  "peerBundle",
  "signatureVerified",
  "safetyNumber",
] as const;

export function diffWorlds(prev: World | null, next: World): ChangeSet {
  if (!prev) return NO_CHANGES;
  const fields = new Set<string>();
  const packets = new Set<string>();

  for (const id of next.deviceOrder) {
    const was = prev.devices[id];
    const is = next.devices[id];
    // A device that did not exist a Step ago has nothing to diff against; it is
    // new, which the UI learns from `deviceOrder` rather than from a field path.
    if (!was || !is) continue;
    for (const key of WATCHED) {
      if (was[key] !== is[key]) fields.add(`${id}.${key}`);
    }
    const wasRatchet = was.ratchet;
    const isRatchet = is.ratchet;
    if (wasRatchet && isRatchet) {
      for (const key of WATCHED_RATCHET) {
        if (wasRatchet[key] !== isRatchet[key]) fields.add(`${id}.${key}`);
      }
    }
    const wasPrekeys = was.prekeys;
    const isPrekeys = is.prekeys;
    if (wasPrekeys && isPrekeys) {
      for (const key of WATCHED_PREKEYS) {
        if (wasPrekeys[key] !== isPrekeys[key]) fields.add(`${id}.${key}`);
      }
    }
  }

  if (prev.stolen !== next.stolen) fields.add("eve.stolen");
  if (prev.cracked !== next.cracked) fields.add("eve.cracked");

  const before = new Map(prev.packets.map((packet) => [packet.id, packet]));
  for (const packet of next.packets) {
    const previous = before.get(packet.id);
    if (
      !previous ||
      previous.payload !== packet.payload ||
      previous.status !== packet.status ||
      previous.tampered !== packet.tampered
    ) {
      packets.add(packet.id);
    }
  }

  return { fields, packets };
}
