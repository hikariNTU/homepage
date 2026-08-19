/**
 * L3 — X3DH, and the first message to somebody who is not there.
 *
 * L1 and L2 both need both devices online to exchange public keys before anything
 * can be encrypted. Real messaging does not work like that: Bob publishes a *prekey
 * bundle* to a server once, goes offline, and Alice can send him a sealed message
 * hours later with no round trip. X3DH is how the two sides reach the same secret
 * from that one-sided exchange.
 *
 * Bob's bundle:
 *   IK_B   identity key      long-term
 *   SPK_B  signed prekey     medium-term, signed by IK_B
 *   OPK_B  one-time prekey    used once, then discarded
 *
 * Alice computes four Diffie-Hellman outputs and runs them through one HKDF:
 *   DH1 = ECDH(IK_A, SPK_B)   binds her identity to his prekey
 *   DH2 = ECDH(EK_A, IK_B)    binds his identity to her ephemeral
 *   DH3 = ECDH(EK_A, SPK_B)   the freshness
 *   DH4 = ECDH(EK_A, OPK_B)   one-time, so a replayed first message dies with it
 * Bob later computes the same four from the private halves he kept plus the two
 * public keys in her message header. Nothing secret is ever sent.
 *
 * The signature is the point of this Level. `crypto.subtle.verify` is a real call
 * returning a real boolean, so Eve substituting the prekey is caught by arithmetic
 * rather than by a claim — run `eve.substituteKey` and watch Alice abort.
 *
 * What a signature cannot do: bind an identity key to a *person*. Eve who replaces
 * the whole bundle, her own signing key included, produces a bundle that verifies
 * perfectly. The answer to that is not cryptographic — it is the safety number both
 * devices display, compared out of band.
 */

import {
  concatBytes,
  decodeFields,
  ecdhSharedSecret,
  encodeFields,
  exportRawPublicKey,
  generateIdentityKeyPair,
  generateSigningKeyPair,
  hkdfBits,
  hkdfInfo,
  importHkdfBaseKey,
  importRawPublicKey,
  importRawVerifyKey,
  sha256,
  signBytes,
  toHex,
  verifyBytes,
} from "../primitives";
import type {
  Action,
  Bytes,
  DeviceId,
  LevelInfo,
  Packet,
  PeerBundle,
  World,
} from "../types";
import {
  ALICE,
  BOB,
  deviceOf,
  findPacket,
  nextId,
  withDevice,
  withPacket,
  withPacketPatch,
  withPrekeys,
  withRatchet,
} from "../world";
import { keygenAction, nameOf, step } from "./common";
import { ratchetSendActions, type SendOptions } from "./ratchet";

export const MESSAGING_L3: LevelInfo = {
  level: "L3",
  title: "X3DH prekey bundle",
  summary:
    "Bob publishes an identity key, a signed prekey and a one-time prekey, then goes offline. Alice verifies the signature, combines four Diffie-Hellman outputs into a root key, and sends a sealed message with no round trip. The ratchet from Mission 02 takes over from there.",
  available: true,
  defences: [
    {
      id: "l3-signed-prekey",
      title: "A substituted prekey is caught",
      detail:
        "Eve swaps the prekey in the bundle for her own and leaves the signature alone. `crypto.subtle.verify` returns false, Alice aborts, and no message is ever sealed. This is the weakness Mission 01 and Mission 02 both carried.",
      answers: "L1",
      attack: "substituteKey",
    },
    {
      id: "l3-offline",
      title: "The first message needs no round trip",
      detail:
        "Bob is offline for the entire handshake. Alice derives the secret from his published bundle alone, and he catches up from the two public keys in her message header when he comes back.",
      answers: "L1",
      attack: "drop",
    },
  ],
  weaknesses: [
    {
      id: "l3-tofu",
      title: "Trust on first use",
      detail:
        "The signature binds the prekey to the identity key. Nothing binds the identity key to a person: Eve who replaces the entire bundle, signing key included, produces one that verifies perfectly. The only answer is out of band — compare the safety number each device shows. Cryptography cannot introduce two strangers.",
      answeredBy: null,
    },
    {
      id: "l3-metadata",
      title: "Metadata is still in the clear",
      detail:
        "Who fetched whose bundle, who sent what to whom and when. X3DH hides the contents of the conversation, never its existence.",
      answeredBy: null,
    },
    {
      id: "l3-skipped-keys",
      title: "Skipped messages still stall the chain",
      detail:
        "Inherited from Mission 02 and still a deliberate simplification: no store of skipped message keys, so an out-of-order message is refused rather than held.",
      answeredBy: null,
    },
  ],
  attacks: ["tamper", "drop", "replay", "compromise", "substituteKey"],
};

const X3DH_INFO = hkdfInfo("L3/x3dh");
/** The 32 `0xFF` bytes X3DH prepends to the DH concatenation, per the spec. */
const X3DH_PREFIX: Bytes = new Uint8Array(32).fill(0xff) as Bytes;
const BUNDLE_FIELDS = 5;

const SIGNING_STAND_IN =
  "Real X3DH uses one Curve25519 identity key for both Diffie-Hellman and signatures, via XEdDSA. Web Crypto will not use one key for two algorithms, so identity here is two key pairs: an ECDH P-256 pair and an ECDSA P-256 pair. Everything the signature proves still holds; it is simply carrying an extra public key.";

function prekeysOf(world: World, device: DeviceId) {
  const prekeys = deviceOf(world, device).prekeys;
  if (!prekeys) throw new Error(`[e2ee] ${device} has no prekeys`);
  return prekeys;
}

function encodeBundle(device: DeviceId, world: World): Bytes {
  const prekeys = prekeysOf(world, device);
  return encodeFields([
    prekeys.signingPublicRaw!,
    deviceOf(world, device).publicKeyRaw!,
    prekeys.signedPreKeyPublicRaw!,
    prekeys.signedPreKeySignature!,
    prekeys.oneTimePreKeyPublicRaw!,
  ]);
}

function decodeBundle(payload: Bytes): PeerBundle | null {
  const fields = decodeFields(payload, BUNDLE_FIELDS);
  if (!fields) return null;
  const [
    signingPublicRaw,
    identityPublicRaw,
    signedPreKeyPublicRaw,
    signedPreKeySignature,
    oneTimePreKeyPublicRaw,
  ] = fields;
  return {
    signingPublicRaw,
    identityPublicRaw,
    signedPreKeyPublicRaw,
    signedPreKeySignature,
    oneTimePreKeyPublicRaw,
  };
}

/** The index of the signed prekey inside the encoded bundle — Eve needs it too. */
export const BUNDLE_SIGNED_PREKEY_FIELD = 2;

export function bundlePacketOf(world: World): Packet | null {
  return (
    world.packets.find((packet) => packet.kind === "prekey-bundle") ?? null
  );
}

// —— Bob, before he goes offline ————————————————————————————————————————————

function publishBundleAction(device: DeviceId, peer: DeviceId): Action {
  const id = nextId(`${device}-bundle`);
  const packetId = nextId("pkt");
  return {
    id,
    label: `${device}.publishPrekeyBundle()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates an identity signing key`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "An ECDSA P-256 pair. Its only job is to sign this device's prekeys, so that anyone fetching them can tell they came from the holder of this identity.",
        standIn: SIGNING_STAND_IN,
        run: async (world) => {
          const pair = await generateSigningKeyPair();
          const raw = await exportRawPublicKey(pair.publicKey);
          return {
            world: withPrekeys(world, device, {
              signingKeyPair: pair,
              signingPublicRaw: raw,
            }),
            inputs: [{ label: "algorithm", text: "ECDSA, curve P-256" }],
            outcome: {
              ok: true,
              values: [{ label: "signing public key", bytes: raw }],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates a signed prekey`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "A medium-term ECDH pair. It is rotated every few days in a real deployment, which limits how long a stolen prekey is useful for.",
        run: async (world) => {
          const pair = await generateIdentityKeyPair();
          const raw = await exportRawPublicKey(pair.publicKey);
          return {
            world: withPrekeys(world, device, {
              signedPreKeyPair: pair,
              signedPreKeyPublicRaw: raw,
            }),
            inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
            outcome: {
              ok: true,
              values: [{ label: "prekey public", bytes: raw }],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} signs the prekey with the identity key`,
        op: "crypto.subtle.sign",
        crypto: "subtle",
        prose:
          "This signature is what makes the bundle worth anything. Without it, the bundle is a pile of public keys with no claim about their origin — which is precisely Mission 01's third weakness.",
        run: async (world) => {
          const prekeys = prekeysOf(world, device);
          const message = prekeys.signedPreKeyPublicRaw!;
          const signature = await signBytes(
            prekeys.signingKeyPair!.privateKey,
            message,
          );
          return {
            world: withPrekeys(world, device, {
              signedPreKeySignature: signature,
            }),
            inputs: [
              { label: "message", bytes: message, note: "The prekey's bytes." },
              { label: "hash", text: "SHA-256" },
            ],
            outcome: {
              ok: true,
              values: [{ label: "signature", bytes: signature }],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates a one-time prekey`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "A pair used for exactly one incoming session and then destroyed. It is what stops a captured first message being replayed into a second session years later.",
        run: async (world) => {
          const pair = await generateIdentityKeyPair();
          const raw = await exportRawPublicKey(pair.publicKey);
          return {
            world: withPrekeys(world, device, {
              oneTimePreKeyPair: pair,
              oneTimePreKeyPublicRaw: raw,
            }),
            inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
            outcome: {
              ok: true,
              values: [{ label: "one-time prekey public", bytes: raw }],
            },
          };
        },
      }),
      step(id, {
        actor: "wire",
        title: `${nameOf(device)}'s bundle goes on the wire, and he goes offline`,
        op: null,
        crypto: "none",
        prose:
          "Five length-prefixed public fields, published once. From here until his own step, this device does nothing at all — every remaining handshake step is Alice's, alone.",
        run: async (world) => {
          const payload = encodeBundle(device, world);
          const packet: Packet = {
            id: packetId,
            from: device,
            to: peer,
            kind: "prekey-bundle",
            label: `${nameOf(device)}'s prekey bundle`,
            payload,
            status: "in-flight",
            tampered: false,
          };
          return {
            world: withPacket(world, packet),
            inputs: [{ label: "encoded bundle", bytes: payload }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "bundle",
                  text: "signing key ‖ identity key ‖ prekey ‖ signature ‖ one-time prekey",
                  note: "All public. Eve can read every byte and change any of them.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

// —— Alice, with only the bundle to work from ——————————————————————————————

/**
 * `abortIds` are the Actions that must not happen if the signature does not check
 * out. Passing them in keeps the abort real: nothing downstream runs, rather than
 * a warning being shown and the handshake continuing anyway.
 */
function fetchBundleAction(
  device: DeviceId,
  peer: DeviceId,
  abortIds: string[],
): Action {
  const id = nextId(`${device}-fetchbundle`);
  const bundlePacket = (world: World) => {
    const packet = bundlePacketOf(world);
    if (!packet) throw new Error("[e2ee] no prekey bundle on the wire");
    return packet;
  };

  return {
    id,
    label: `${device}.fetchPrekeyBundle(${peer})`,
    actor: device,
    steps: [
      step(id, {
        actor: "wire",
        title: `${nameOf(device)} fetches the bundle`,
        op: null,
        crypto: "none",
        prose:
          "Delivery and decoding, no cryptography. If the framing does not parse, the bytes were altered in a way no signature check is even reached for.",
        run: async (world) => {
          const packet = bundlePacket(world);
          const bundle = decodeBundle(packet.payload);
          if (!bundle) {
            return {
              world: withPacketPatch(world, packet.id, { status: "delivered" }),
              inputs: [{ label: "payload", bytes: packet.payload }],
              outcome: {
                ok: false,
                errorName: "MalformedBundle",
                errorMessage:
                  "The length prefixes do not add up to the payload. Someone altered the framing in flight.",
              },
              cancelActionIds: [id, ...abortIds],
            };
          }
          return {
            world: withPrekeys(
              withPacketPatch(world, packet.id, { status: "delivered" }),
              device,
              { peerBundle: bundle },
            ),
            inputs: [{ label: "payload", bytes: packet.payload }],
            outcome: {
              ok: true,
              values: [
                { label: "identity key", bytes: bundle.identityPublicRaw },
                { label: "prekey", bytes: bundle.signedPreKeyPublicRaw },
                { label: "signature", bytes: bundle.signedPreKeySignature },
                {
                  label: "one-time prekey",
                  bytes: bundle.oneTimePreKeyPublicRaw,
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the identity signing key`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "The verifying half of the peer's identity, as an ECDSA public key. Note the order of events: this key is trusted because it is the identity being claimed, and the next step checks only that the prekey agrees with it.",
        standIn: SIGNING_STAND_IN,
        run: async (world) => {
          const bundle = prekeysOf(world, device).peerBundle!;
          const key = await importRawVerifyKey(bundle.signingPublicRaw);
          return {
            world: withPrekeys(world, device, { peerVerifyKey: key }),
            inputs: [{ label: "raw key", bytes: bundle.signingPublicRaw }],
            outcome: {
              ok: true,
              values: [
                { label: "verify key", text: "CryptoKey (public, ECDSA)" },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} verifies the prekey signature`,
        op: "crypto.subtle.verify",
        crypto: "subtle",
        prose:
          "A real boolean from a real ECDSA verification. True means the prekey was signed by the identity key in this bundle. False means somebody rewrote the bundle in flight, and the only safe move is to stop.",
        run: async (world) => {
          const prekeys = prekeysOf(world, device);
          const bundle = prekeys.peerBundle!;
          const ok = await verifyBytes(
            prekeys.peerVerifyKey!,
            bundle.signedPreKeySignature,
            bundle.signedPreKeyPublicRaw,
          );
          const inputs = [
            { label: "signature", bytes: bundle.signedPreKeySignature },
            { label: "signed data", bytes: bundle.signedPreKeyPublicRaw },
          ];
          if (!ok) {
            return {
              world: withPrekeys(world, device, { signatureVerified: false }),
              inputs,
              outcome: {
                ok: false,
                errorName: "SignatureRejected",
                errorMessage:
                  "crypto.subtle.verify returned false. The prekey in this bundle was not signed by the identity key that came with it, so the bundle is not usable and the handshake stops here. Nothing was encrypted; there is nothing for Eve to have.",
              },
              cancelActionIds: [id, ...abortIds],
            };
          }
          return {
            world: withPrekeys(world, device, { signatureVerified: true }),
            inputs,
            outcome: {
              ok: true,
              values: [
                {
                  label: "verified",
                  text: "true",
                  note: "The prekey belongs to the identity key in the bundle.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the peer's identity key for ECDH`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "The same bytes the signature covered, now as an ECDH public key so they can take part in the four exchanges.",
        run: async (world) => {
          const bundle = prekeysOf(world, device).peerBundle!;
          const key = await importRawPublicKey(bundle.identityPublicRaw);
          return {
            world: withDevice(world, device, {
              peerPublicKey: key,
              peerPublicKeyRaw: bundle.identityPublicRaw,
            }),
            inputs: [{ label: "raw key", bytes: bundle.identityPublicRaw }],
            outcome: {
              ok: true,
              values: [
                { label: `${peer} identity key`, text: "CryptoKey (public)" },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} computes the safety number`,
        op: "crypto.subtle.digest",
        crypto: "subtle",
        prose:
          "SHA-256 over both identity keys, in a fixed order. Both devices compute the same digest, and comparing it out of band — in person, over the phone — is the only thing that catches an Eve who replaced the whole bundle, signature and all. Cryptography cannot introduce two strangers.",
        run: async (world) => {
          const self = deviceOf(world, device);
          const bundle = prekeysOf(world, device).peerBundle!;
          const pair = [self.publicKeyRaw!, bundle.identityPublicRaw].sort(
            (a, b) => (toHex(a) < toHex(b) ? -1 : 1),
          );
          const digest = await sha256(concatBytes(pair));
          return {
            world: withPrekeys(world, device, { safetyNumber: digest }),
            inputs: [
              { label: "own identity key", bytes: self.publicKeyRaw! },
              {
                label: `${peer} identity key`,
                bytes: bundle.identityPublicRaw,
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "safety number",
                  bytes: digest,
                  note: "Compare with the other device. A mismatch means someone is in the middle.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/** Alice's four exchanges and the one HKDF that combines them. */
function initiatorX3dhAction(device: DeviceId, peer: DeviceId): Action {
  const id = nextId(`${device}-x3dh`);

  const dhStep = (
    index: number,
    title: string,
    prose: string,
    pick: (
      world: World,
    ) => Promise<{ privateKey: CryptoKey; publicRaw: Bytes; label: string }>,
  ) =>
    step(id, {
      actor: device,
      title,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose,
      run: async (world) => {
        const prekeys = prekeysOf(world, device);
        const { privateKey, publicRaw, label } = await pick(world);
        const peerKey = await importRawPublicKey(publicRaw);
        const output = await ecdhSharedSecret(privateKey, peerKey);
        return {
          world: withPrekeys(world, device, {
            dhOutputs: [...prekeys.dhOutputs, output],
          }),
          inputs: [{ label: "peer key", bytes: publicRaw, note: label }],
          outcome: {
            ok: true,
            values: [{ label: `DH${index}`, bytes: output }],
          },
        };
      },
    });

  return {
    id,
    label: `${device}.x3dh(${peer})`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates an ephemeral key pair`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "One key pair for one handshake. Its public half rides in the first message's header; its private half is what makes three of the four exchanges fresh.",
        run: async (world) => {
          const pair = await generateIdentityKeyPair();
          const raw = await exportRawPublicKey(pair.publicKey);
          return {
            world: withPrekeys(world, device, {
              ephemeralKeyPair: pair,
              ephemeralPublicRaw: raw,
            }),
            inputs: [{ label: "algorithm", text: "ECDH, curve P-256" }],
            outcome: {
              ok: true,
              values: [{ label: "ephemeral public key", bytes: raw }],
            },
          };
        },
      }),
      dhStep(
        1,
        `DH1 — ${nameOf(device)}'s identity key against the prekey`,
        "Binds this handshake to Alice's long-term identity: only the holder of her private identity key can produce this output.",
        async (world) => ({
          privateKey: deviceOf(world, device).identityKeyPair!.privateKey,
          publicRaw: prekeysOf(world, device).peerBundle!.signedPreKeyPublicRaw,
          label: "the signed prekey",
        }),
      ),
      dhStep(
        2,
        `DH2 — the ephemeral key against ${nameOf(peer)}'s identity key`,
        "Binds it to Bob's long-term identity, so nobody but the real Bob can complete it.",
        async (world) => ({
          privateKey: prekeysOf(world, device).ephemeralKeyPair!.privateKey,
          publicRaw: prekeysOf(world, device).peerBundle!.identityPublicRaw,
          label: "the identity key",
        }),
      ),
      dhStep(
        3,
        "DH3 — the ephemeral key against the prekey",
        "Neither side's long-term key is involved, which is what keeps the session secret even if an identity key leaks later.",
        async (world) => ({
          privateKey: prekeysOf(world, device).ephemeralKeyPair!.privateKey,
          publicRaw: prekeysOf(world, device).peerBundle!.signedPreKeyPublicRaw,
          label: "the signed prekey",
        }),
      ),
      dhStep(
        4,
        "DH4 — the ephemeral key against the one-time prekey",
        "The one-time key is destroyed after this session, so the exact same first message can never establish a second session.",
        async (world) => ({
          privateKey: prekeysOf(world, device).ephemeralKeyPair!.privateKey,
          publicRaw: prekeysOf(world, device).peerBundle!
            .oneTimePreKeyPublicRaw,
          label: "the one-time prekey",
        }),
      ),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the four outputs as one HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "32 bytes of 0xFF, then DH1 ‖ DH2 ‖ DH3 ‖ DH4, exactly as X3DH specifies. The prefix is domain separation; the order matters because both sides have to concatenate identically.",
        run: async (world) => {
          const outputs = prekeysOf(world, device).dhOutputs;
          const material = concatBytes([X3DH_PREFIX, ...outputs]);
          const baseKey = await importHkdfBaseKey(material);
          return {
            world: withDevice(world, device, {
              hkdfBaseKey: baseKey,
              sharedSecret: material,
            }),
            inputs: outputs.map((bytes, index) => ({
              label: `DH${index + 1}`,
              bytes,
            })),
            outcome: {
              ok: true,
              values: [
                {
                  label: "input key material",
                  bytes: material,
                  note: `${material.length} bytes: the 0xFF prefix and four 32-byte outputs.`,
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} derives the root key`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "One HKDF over all four exchanges gives the root key the ratchet starts from. Bob will reach these same bytes from his stored private keys and the two public keys in the message header — without ever having been online.",
        standIn:
          "Real X3DH also binds IK_A ‖ IK_B into the first message's associated data. Here the AAD binds the ratchet header, which carries both of those keys on the first message, so the same bytes are authenticated by a slightly different route.",
        run: async (world) => {
          const rootKey = await hkdfBits(
            deviceOf(world, device).hkdfBaseKey!,
            X3DH_INFO,
            256,
          );
          const prekeys = prekeysOf(world, device);
          const self = deviceOf(world, device);
          const peerRatchet = await importRawPublicKey(
            prekeys.peerBundle!.signedPreKeyPublicRaw,
          );
          return {
            // The signed prekey is Bob's initial ratchet key: he has its private
            // half, so Alice's first DH ratchet step lands on something he can
            // follow. Bookkeeping, not a call.
            world: withRatchet(world, device, {
              rootKey,
              selfKeyPair: self.identityKeyPair,
              selfPublicRaw: self.publicKeyRaw,
              peerPublic: peerRatchet,
              peerPublicRaw: prekeys.peerBundle!.signedPreKeyPublicRaw,
            }),
            inputs: [{ label: "info", bytes: X3DH_INFO }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "root key",
                  bytes: rootKey,
                  note: "The ratchet's starting point. No message key yet — the first send does a DH ratchet.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

// —— Bob, coming back online ————————————————————————————————————————————————

/** The mirror: the same four exchanges from the private halves Bob kept. */
export function responderX3dhAction(
  device: DeviceId,
  peer: DeviceId,
  packetId: string,
): Action {
  const id = nextId(`${device}-x3dh`);

  const dhStep = (
    index: number,
    title: string,
    prose: string,
    pick: (
      world: World,
      header: NonNullable<Packet["header"]>,
    ) => { privateKey: CryptoKey; publicRaw: Bytes; label: string },
  ) =>
    step(id, {
      actor: device,
      title,
      op: "crypto.subtle.deriveBits",
      crypto: "subtle",
      prose,
      run: async (world) => {
        const prekeys = prekeysOf(world, device);
        const header = findPacket(world, packetId).header!;
        const { privateKey, publicRaw, label } = pick(world, header);
        const peerKey = await importRawPublicKey(publicRaw);
        const output = await ecdhSharedSecret(privateKey, peerKey);
        return {
          world: withPrekeys(world, device, {
            dhOutputs: [...prekeys.dhOutputs, output],
          }),
          inputs: [{ label: "peer key", bytes: publicRaw, note: label }],
          outcome: {
            ok: true,
            values: [
              {
                label: `DH${index}`,
                bytes: output,
                note: "Compare with the same output on the other device.",
              },
            ],
          },
        };
      },
    });

  return {
    id,
    label: `${device}.x3dhFromHeader()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} comes online and reads the header`,
        op: null,
        crypto: "none",
        prose:
          "No cryptography: he takes the identity key and the ephemeral key out of the message header. Those two public keys plus the private halves he kept are everything he needs — there was never a round trip.",
        run: async (world) => {
          const header = findPacket(world, packetId).header!;
          return {
            // The sender's identity key is recorded on the device, not just read:
            // it is now something he knows about the other party, and L6 needs it
            // to seal an envelope back the other way.
            world: withPrekeys(
              withDevice(world, device, {
                peerPublicKeyRaw: header.identityPublicRaw ?? null,
              }),
              device,
              { dhOutputs: [] },
            ),
            inputs: [
              { label: "sender identity key", bytes: header.identityPublicRaw },
              {
                label: "sender ephemeral key",
                bytes: header.ephemeralPublicRaw,
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "prekeys held",
                  text: "identity · signed prekey · one-time prekey",
                },
              ],
            },
          };
        },
      }),
      dhStep(
        1,
        `DH1 — the prekey against ${nameOf(peer)}'s identity key`,
        "The mirror of Alice's DH1: his prekey's private half, her identity key's public half. Same output, opposite sides.",
        (world, header) => ({
          privateKey: prekeysOf(world, device).signedPreKeyPair!.privateKey,
          publicRaw: header.identityPublicRaw!,
          label: "sender identity key",
        }),
      ),
      dhStep(
        2,
        `DH2 — the identity key against the ephemeral key`,
        "The mirror of DH2.",
        (world, header) => ({
          privateKey: deviceOf(world, device).identityKeyPair!.privateKey,
          publicRaw: header.ephemeralPublicRaw!,
          label: "sender ephemeral key",
        }),
      ),
      dhStep(
        3,
        "DH3 — the prekey against the ephemeral key",
        "The mirror of DH3.",
        (world, header) => ({
          privateKey: prekeysOf(world, device).signedPreKeyPair!.privateKey,
          publicRaw: header.ephemeralPublicRaw!,
          label: "sender ephemeral key",
        }),
      ),
      dhStep(
        4,
        "DH4 — the one-time prekey against the ephemeral key",
        "The mirror of DH4. After this the one-time private key is deleted, so this exchange can never be repeated.",
        (world, header) => ({
          privateKey: prekeysOf(world, device).oneTimePreKeyPair!.privateKey,
          publicRaw: header.ephemeralPublicRaw!,
          label: "sender ephemeral key",
        }),
      ),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the four outputs as one HKDF input`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "The same concatenation in the same order. If a single byte of the bundle Alice fetched had been altered, these outputs would not match hers and nothing below would open.",
        run: async (world) => {
          const outputs = prekeysOf(world, device).dhOutputs;
          const material = concatBytes([X3DH_PREFIX, ...outputs]);
          const baseKey = await importHkdfBaseKey(material);
          return {
            world: withDevice(world, device, {
              hkdfBaseKey: baseKey,
              sharedSecret: material,
            }),
            inputs: outputs.map((bytes, index) => ({
              label: `DH${index + 1}`,
              bytes,
            })),
            outcome: {
              ok: true,
              values: [{ label: "input key material", bytes: material }],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} derives the same root key`,
        op: "crypto.subtle.deriveBits",
        crypto: "subtle",
        prose:
          "Identical to the root key on the other device, reached with no round trip and nothing secret on the wire. The one-time prekey is destroyed at this point: it has done its one job.",
        run: async (world) => {
          const rootKey = await hkdfBits(
            deviceOf(world, device).hkdfBaseKey!,
            X3DH_INFO,
            256,
          );
          const prekeys = prekeysOf(world, device);
          return {
            world: withRatchet(
              withPrekeys(world, device, {
                oneTimePreKeyUsed: true,
                oneTimePreKeyPair: null,
              }),
              device,
              {
                rootKey,
                // His signed prekey is the ratchet key Alice ratcheted against.
                selfKeyPair: prekeys.signedPreKeyPair,
                selfPublicRaw: prekeys.signedPreKeyPublicRaw,
              },
            ),
            inputs: [{ label: "info", bytes: X3DH_INFO }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "root key",
                  bytes: rootKey,
                  note: "Compare with the other device: identical.",
                },
                {
                  label: "one-time prekey",
                  text: "destroyed",
                  note: "Used once, as designed.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

// —— the Script ————————————————————————————————————————————————————————————

const FIRST_MESSAGE = "hey bob — you were not even online for this";

/**
 * Bob publishes and goes quiet; Alice does the whole handshake alone; her first
 * message is sealed and sent; only then does Bob do anything.
 *
 * The opening message is the caller's, because every Level from L4 up is this
 * handshake with a different first thing to say — an attachment pointer, a
 * message that will end up in a backup, a sealed-sender envelope. Only the
 * handshake is shared, and only it lives here.
 */
export function x3dhScript(
  world: World,
  opening: (world: World) => Action[],
): Action[] {
  const x3dh = initiatorX3dhAction(ALICE, BOB);
  const openingActions = opening(world);

  // The signature check aborts everything after it, so it has to know their ids.
  const abortIds = [x3dh.id, ...openingActions.map((action) => action.id)];

  return [
    keygenAction(ALICE),
    keygenAction(BOB),
    publishBundleAction(BOB, ALICE),
    fetchBundleAction(ALICE, BOB, abortIds),
    x3dh,
    ...openingActions,
  ];
}

export function messagingL3Script(world: World): Action[] {
  return x3dhScript(world, (current) =>
    messagingL3SendActions(current, ALICE, BOB, FIRST_MESSAGE, {
      firstMessage: true,
    }),
  );
}

/**
 * L3 sends are L2 sends with two extra public keys in the header on the first one,
 * which is what lets a recipient who has never been online catch up.
 */
export function messagingL3SendActions(
  world: World,
  from: DeviceId,
  to: DeviceId,
  text: string,
  options: { firstMessage?: boolean } & SendOptions = {},
): Action[] {
  const { firstMessage, ...send } = options;
  if (!firstMessage) return ratchetSendActions(world, from, to, text, send);
  return ratchetSendActions(world, from, to, text, {
    ...send,
    ...firstMessageOptions(from, to),
  });
}

/**
 * What makes a message the *first* one: the two public keys the recipient needs
 * to reconstruct the secret he was offline for, and his half of X3DH run before
 * he can ratchet. Exported because L4 and L6 open their own conversations.
 */
export function firstMessageOptions(
  from: DeviceId,
  to: DeviceId,
): Pick<SendOptions, "extraHeader" | "beforeDelivery"> {
  return {
    extraHeader: (current) => ({
      identityPublicRaw: deviceOf(current, from).publicKeyRaw ?? undefined,
      ephemeralPublicRaw:
        deviceOf(current, from).prekeys?.ephemeralPublicRaw ?? undefined,
      usedOneTimePreKey: true,
    }),
    beforeDelivery: (packetId) => [responderX3dhAction(to, from, packetId)],
  };
}
