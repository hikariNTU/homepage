/**
 * Thin, named wrappers over Web Crypto. Every function here maps to exactly one
 * `crypto.subtle` call (the display-only exports excepted, and marked as such),
 * so a Step in the visualiser can claim a 1:1 relationship with a real call.
 *
 * No React, no DOM.
 */

import type { Bytes, DeviceId, Packet, PacketHeader, World } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Every algorithm choice the visualiser makes, in one place. */
export const PARAMS = {
  ecdh: { name: "ECDH", namedCurve: "P-256" },
  /** L3 only: identity signatures over the signed prekey. */
  ecdsa: { name: "ECDSA", namedCurve: "P-256" },
  hkdfHash: "SHA-256",
  hkdfSalt: encoder.encode("e2ee-visualiser/salt/v1"),
  aes: { name: "AES-GCM", length: 256 },
  /** AES-GCM nonce length. Last 4 bytes carry the sender's message counter. */
  nonceBytes: 12,
  sharedSecretBits: 256,
} as const;

export const PARAMS_SUMMARY =
  "ECDH P-256 → HKDF-SHA-256 → AES-GCM-256, 12-byte nonce, AAD binds sender + counter";

/** What each Level actually runs, for the header's ⓘ. */
export const PARAMS_BY_LEVEL: Record<string, string> = {
  L1: PARAMS_SUMMARY,
  L2: "Static ECDH P-256 to seed a root key, then Signal's double ratchet: HMAC-SHA-256 chain KDF per message, HKDF-SHA-256 root KDF per direction change, AES-GCM-256 per message key, key deleted after one use",
  L3: "X3DH over P-256: ECDSA-signed prekey, four ECDH deriveBits combined through HKDF-SHA-256 into the root key, then the same double ratchet as L2",
};

export function utf8(text: string): Bytes {
  return encoder.encode(text);
}

export function fromUtf8(bytes: Bytes): string {
  return decoder.decode(bytes);
}

export function toHex(bytes: Bytes): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hex in groups of two bytes, for reading rather than copying. */
export function toHexBlocks(bytes: Bytes, groupBytes = 2): string {
  const hex = toHex(bytes);
  const size = groupBytes * 2;
  const groups: string[] = [];
  for (let i = 0; i < hex.length; i += size)
    groups.push(hex.slice(i, i + size));
  return groups.join(" ");
}

function bytes(buffer: ArrayBuffer): Bytes {
  return new Uint8Array(buffer);
}

/**
 * A fresh ECDH identity key pair. Deliberately `extractable: true`: the panel
 * shows the reader real private key bytes, because seeing that the private
 * scalar exists and never travels is much of the lesson. The safety property is
 * enforced structurally instead — see `assertPacketCarriesNoPrivateMaterial`.
 */
export function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(PARAMS.ecdh, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

export async function exportRawPublicKey(key: CryptoKey): Promise<Bytes> {
  return bytes(await crypto.subtle.exportKey("raw", key));
}

/** Display only — not part of any protocol Step. Never enters a Packet. */
export async function exportPrivateKeyBytes(key: CryptoKey): Promise<Bytes> {
  return bytes(await crypto.subtle.exportKey("pkcs8", key));
}

export function importRawPublicKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, PARAMS.ecdh, true, []);
}

export async function ecdhSharedSecret(
  ownPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: peerPublicKey },
      ownPrivateKey,
      PARAMS.sharedSecretBits,
    ),
  );
}

/**
 * The raw shared secret imported as HKDF input material. HKDF base keys must be
 * non-extractable per spec, which is why the panel shows the secret's bytes from
 * the ECDH output rather than from this key.
 */
export function importHkdfBaseKey(sharedSecret: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);
}

export function hkdfInfo(level: string): Bytes {
  return utf8(`e2ee-visualiser/messaging/${level}`);
}

export function deriveMessageKey(
  baseKey: CryptoKey,
  info: Bytes,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: PARAMS.hkdfHash,
      salt: PARAMS.hkdfSalt,
      info,
    },
    baseKey,
    PARAMS.aes,
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportAesKeyBytes(key: CryptoKey): Promise<Bytes> {
  return bytes(await crypto.subtle.exportKey("raw", key));
}

/** A raw 32-byte key, back as an AES-GCM `CryptoKey`. */
export function importAesKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, PARAMS.aes, true, [
    "encrypt",
    "decrypt",
  ]);
}

// —— the double ratchet's two KDFs (L2, L3) ————————————————————————————————
//
// Both are what Signal specifies, not a simplification: the chain KDF is HMAC
// under the chain key with a one-byte domain separator, and the root KDF is HKDF
// with the old root key as the salt and the fresh DH output as input material.

/** Chain keys are HMAC keys, so stepping a chain forward is a real `sign` call. */
export function importChainKey(chainKey: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    chainKey,
    { name: "HMAC", hash: PARAMS.hkdfHash },
    false,
    ["sign"],
  );
}

export async function hmac(key: CryptoKey, data: Bytes): Promise<Bytes> {
  return bytes(await crypto.subtle.sign("HMAC", key, data));
}

/** Domain separators for the chain KDF: message key, then next chain key. */
export const CHAIN_MESSAGE_INFO: Bytes = new Uint8Array([0x01]);
export const CHAIN_NEXT_INFO: Bytes = new Uint8Array([0x02]);

/**
 * The root KDF's output: 64 bytes, split into the next root key and the chain key
 * for the direction that just changed.
 */
export type RootKdfOutput = { rootKey: Bytes; chainKey: Bytes };

export function splitRootKdf(output: Bytes): RootKdfOutput {
  return {
    rootKey: output.slice(0, 32) as Bytes,
    chainKey: output.slice(32, 64) as Bytes,
  };
}

/**
 * HKDF over a fresh DH output, salted with the current root key. 512 bits out:
 * the new root key and the new chain key. The first ratchet step of a session has
 * no root key yet, so the salt is 32 zero bytes, exactly as Signal specifies.
 */
export async function rootRatchetBits(
  dhOutputKey: CryptoKey,
  rootKey: Bytes | null,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: PARAMS.hkdfHash,
        salt: rootKey ?? new Uint8Array(32),
        info: utf8("e2ee-visualiser/ratchet/root"),
      },
      dhOutputKey,
      512,
    ),
  );
}

/** HKDF with the fixed salt, for the one-off derivations that seed a ratchet. */
export async function hkdfBits(
  baseKey: CryptoKey,
  info: Bytes,
  bits: number,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: PARAMS.hkdfHash,
        salt: PARAMS.hkdfSalt,
        info,
      },
      baseKey,
      bits,
    ),
  );
}

// —— signatures and digests (L3) ——————————————————————————————————————————

/**
 * An ECDSA P-256 signing key. In real X3DH the identity key is a single
 * Curve25519 key used for both Diffie-Hellman and signatures (XEdDSA); Web Crypto
 * refuses to use one key for two algorithms, so identity is two key pairs here.
 * Every Step that touches this one says so.
 */
export function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(PARAMS.ecdsa, true, ["sign", "verify"]);
}

export function importRawVerifyKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, PARAMS.ecdsa, true, ["verify"]);
}

export async function signBytes(
  privateKey: CryptoKey,
  data: Bytes,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: PARAMS.hkdfHash },
      privateKey,
      data,
    ),
  );
}

/**
 * Returns false on a bad signature rather than throwing — which is precisely the
 * outcome the substituted-key Attack produces, so the caller must check it.
 */
export function verifyBytes(
  publicKey: CryptoKey,
  signature: Bytes,
  data: Bytes,
): Promise<boolean> {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: PARAMS.hkdfHash },
    publicKey,
    signature,
    data,
  );
}

export async function sha256(data: Bytes): Promise<Bytes> {
  return bytes(await crypto.subtle.digest("SHA-256", data));
}

// —— wire framing ——————————————————————————————————————————————————————————

export function concatBytes(parts: Bytes[]): Bytes {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total) as Bytes;
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Length-prefixed fields, so a prekey bundle is one byte string on the wire that
 * Eve can alter at any offset — including a length prefix, which is why decoding
 * has to be able to fail.
 */
export function encodeFields(fields: Bytes[]): Bytes {
  return concatBytes(
    fields.flatMap((field) => {
      const prefix = new Uint8Array(2) as Bytes;
      new DataView(prefix.buffer).setUint16(0, field.length, false);
      return [prefix, field];
    }),
  );
}

/** `null` when the framing does not parse — a legitimate outcome after tampering. */
export function decodeFields(payload: Bytes, count: number): Bytes[] | null {
  const fields: Bytes[] = [];
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    if (at + 2 > payload.length) return null;
    const length = new DataView(
      payload.buffer,
      payload.byteOffset + at,
      2,
    ).getUint16(0, false);
    at += 2;
    if (at + length > payload.length) return null;
    fields.push(payload.slice(at, at + length) as Bytes);
    at += length;
  }
  return at === payload.length ? fields : null;
}

/** 12 bytes: 8-byte sender tag, then the counter big-endian in the last 4. */
export function nonceFor(sender: DeviceId, counter: number): Bytes {
  const nonce = new Uint8Array(PARAMS.nonceBytes);
  nonce.set(utf8(sender === "alice" ? "alice---" : "bob-----").slice(0, 8), 0);
  new DataView(nonce.buffer).setUint32(8, counter, false);
  return nonce;
}

/** Associated data: authenticated but not encrypted. Binds sender and counter. */
export function aadFor(sender: DeviceId, counter: number): Bytes {
  return utf8(`${sender}|${counter}`);
}

/**
 * L2+ associated data: every field of the public header, so altering the ratchet
 * key or the counter in flight fails the tag check just as altering the ciphertext
 * would. The recipient rebuilds this from the header it received, which is what
 * makes the check meaningful.
 */
export function aadForHeader(header: PacketHeader): Bytes {
  const parts = [`${header.sender}|${header.counter}`];
  if (header.ratchetPublicRaw)
    parts.push(`rk:${toHex(header.ratchetPublicRaw)}`);
  if (header.identityPublicRaw) {
    parts.push(`ik:${toHex(header.identityPublicRaw)}`);
  }
  if (header.ephemeralPublicRaw) {
    parts.push(`ek:${toHex(header.ephemeralPublicRaw)}`);
  }
  return utf8(parts.join("|"));
}

export async function sealAesGcm(
  key: CryptoKey,
  nonce: Bytes,
  aad: Bytes,
  plaintext: Bytes,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad },
      key,
      plaintext,
    ),
  );
}

/** Throws `OperationError` when the GCM tag does not verify. Let it throw. */
export async function openAesGcm(
  key: CryptoKey,
  nonce: Bytes,
  aad: Bytes,
  ciphertext: Bytes,
): Promise<Bytes> {
  return bytes(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad },
      key,
      ciphertext,
    ),
  );
}

/** Flip one bit of one byte — the smallest possible tampering. */
export function flipByte(payload: Bytes, index: number): Bytes {
  const altered = payload.slice();
  const at = Math.min(Math.max(index, 0), altered.length - 1);
  altered[at] ^= 0x01;
  return altered;
}

export function randomByteIndex(length: number): number {
  if (length <= 0) return 0;
  return crypto.getRandomValues(new Uint32Array(1))[0] % length;
}

function includesSubsequence(haystack: Bytes, needle: Bytes) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Dev-only guard for the invariant the whole page rests on: private key material
 * never reaches the Wire. Called by every Step that places a Packet.
 */
export function assertPacketCarriesNoPrivateMaterial(
  packet: Packet,
  world: World,
) {
  if (!import.meta.env?.DEV) return;
  for (const device of [world.alice, world.bob]) {
    const priv = device.privateKeyBytes;
    if (priv && includesSubsequence(packet.payload, priv)) {
      throw new Error(
        `[e2ee] invariant broken: packet ${packet.id} carries ${device.id}'s private key material`,
      );
    }
  }
}
