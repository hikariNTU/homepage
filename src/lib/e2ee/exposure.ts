/**
 * What Eve can open, and what she has opened.
 *
 * There is only one state worth showing — the plaintext. "She holds the key that
 * would open this" was a distinction without a difference: at L1 holding it *is*
 * reading it, so the page now runs the decrypt and shows the sentence, exactly as
 * it does for the first message. Every plaintext on screen came out of a real
 * `crypto.subtle.decrypt`; nothing is asserted on the strength of key identity
 * alone.
 *
 * The predicate is deliberately not a UI concern: `holdsSealingKey` decides whether
 * to *queue* the Steps that do the work, and the UI only ever reads `crackedOf`.
 * Which means a packet sealed after the theft is opened on arrival, without anyone
 * having to remember to go back and mark it.
 */

import type { CrackedMessage, Level, Packet, World } from "./types";

/** Does Eve hold a key that opens sealed messages at this Level? */
export function holdsSealingKey(world: World, level: Level): boolean {
  // Only the static-key Level. Elsewhere a stolen chain key produces *future*
  // message keys, which is a different claim and not one about a captured Packet.
  return (
    level === "L1" &&
    world.stolen.some((item) => item.kind === "message-key" && item.key)
  );
}

/** The key itself, once she has one. */
export function sealingKeyOf(world: World): CryptoKey | null {
  return (
    world.stolen.find((item) => item.kind === "message-key" && item.key)?.key ??
    null
  );
}

/** Sealed messages she could open and has not opened yet, oldest first. */
export function openablePackets(world: World, level: Level): Packet[] {
  if (!holdsSealingKey(world, level)) return [];
  return world.packets.filter(
    (packet) =>
      packet.kind === "sealed-message" &&
      packet.status !== "dropped" &&
      !crackedOf(world, packet.id),
  );
}

/** What came out when she opened this Packet, if she has. */
export function crackedOf(
  world: World,
  packetId: string,
): CrackedMessage | undefined {
  return world.cracked.find((entry) => entry.packetId === packetId);
}
