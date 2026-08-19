/**
 * L4 — attachments.
 *
 * The session is L3's, unchanged. What is new is a file, and the fact that no
 * shipping messenger puts a file through the ratchet.
 *
 * What they do instead is here in full: a fresh random AES-GCM key that comes from
 * the CSPRNG and nothing else, the ciphertext uploaded to an ordinary CDN that is
 * not part of the conversation, a SHA-256 digest so a swapped blob is caught, and
 * a pointer — url, key, digest — sent as a normal sealed message. The pointer is
 * protected by everything L1–L3 built. The blob is protected by one key that will
 * still be valid long after every chain key in this session is gone.
 *
 * That is not an oversight. Attachments have to re-download on a new phone, months
 * later, from a message you scroll back to — and forward secrecy is exactly the
 * property that makes old bytes unrecoverable. L4 is the Level where the product
 * requirement and the cryptography want opposite things, and the product wins.
 */

import {
  bytesEqual,
  exportAesKeyBytes,
  generateAesKey,
  importAesKey,
  nonceFor,
  openAesGcm,
  sealAesGcm,
  sha256,
  toHex,
  utf8,
} from "../primitives";
// Inlined rather than fetched: a Step that had to await the network before it
// could encrypt would be a Step whose timing says nothing about cryptography. It
// is the site's own manifest icon at 128px — small enough that shipping it as
// base64 costs the route ~10 kB, where the full-size original cost 62.
import attachmentDataUri from "@/assets/e2ee-attachment.png?inline";
import type { Action, Bytes, DeviceId, LevelInfo, World } from "../types";
import {
  ALICE,
  BOB,
  deviceOf,
  findStored,
  nextId,
  withMedia,
  withStored,
} from "../world";
import { nameOf, step } from "./common";
import {
  firstMessageOptions,
  messagingL3SendActions,
  x3dhScript,
} from "./messaging-l3";
import { ratchetSendActions } from "./ratchet";

export const MESSAGING_L4: LevelInfo = {
  level: "L4",
  title: "Attachments",
  summary:
    "A file does not go through the ratchet. It is sealed under its own random key, the ciphertext is uploaded to an ordinary CDN, and only the key and a digest travel inside a message — which buys re-download at the cost of the forward secrecy every other byte on this page has.",
  available: true,
  defences: [
    {
      id: "l4-digest-catches-swap",
      title: "A swapped blob is caught",
      detail:
        "Eve owns the CDN as surely as she owns the wire, and she can replace the stored bytes with anything she likes. She cannot make SHA-256 agree: the digest came inside a sealed message she could not read or alter, and the recipient checks it before decrypting anything.",
      answers: "L4",
      attack: "swapBlob",
    },
  ],
  weaknesses: [
    {
      id: "l4-media-key-outlives",
      title: "The media key outlives the ratchet",
      detail:
        "It is deliberately kept outside the chain so the file can still be fetched next week. That is a product requirement and a permanent hole in the same sentence: steal it and the attachment opens, however far the message ratchet has moved on.",
      answeredBy: null,
      attack: "compromise",
    },
    {
      id: "l4-cdn-holds-bytes",
      title: "The CDN holds the ciphertext forever",
      detail:
        "Deleting a message deletes a pointer. The blob stays on a server nobody in the conversation controls, and its size was never hidden from anyone — a 2 MB attachment is a photo and a 40 MB one is a video, before a single byte is decrypted.",
      answeredBy: null,
    },
    {
      id: "l4-forwarding-reuploads",
      title: "Forwarding re-uploads rather than re-keys",
      detail:
        "Passing the file on means encrypting it again under a new key and putting a second copy on the CDN. The operator now holds two blobs of identical length appearing minutes apart, which says most of what the plaintext would have.",
      answeredBy: null,
    },
  ],
  attacks: [
    "tamper",
    "drop",
    "replay",
    "compromise",
    "substituteKey",
    "swapBlob",
  ],
};

/**
 * The file: a real PNG, bundled as a data URI and decoded to bytes here.
 *
 * A synthetic ramp would have been simpler and would have made the payoff a lie —
 * the point of an attachment Level is that a *picture* went through a server that
 * never held the key, and the recipient's panel can only show that if what comes
 * out of `decrypt` is genuinely an image. Its size is real too, which is half of
 * what the CDN learns.
 */
export const ATTACHMENT_LABEL = "avatar.png";
export const ATTACHMENT_MIME = "image/png";

function decodeDataUri(uri: string): Bytes {
  const binary = atob(uri.slice(uri.indexOf(",") + 1));
  const out = new Uint8Array(binary.length) as Bytes;
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Decoded once: the same file every time, as a file on a phone would be. */
const ATTACHMENT_BYTES = decodeDataUri(attachmentDataUri);

function attachmentBytes(): Bytes {
  return ATTACHMENT_BYTES.slice() as Bytes;
}

/** For the panels: bytes back to something an `<img>` can take. */
export function imageDataUri(bytes: Bytes): string {
  let binary = "";
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return `data:${ATTACHMENT_MIME};base64,${btoa(binary)}`;
}

/** What travels inside the sealed message: everything needed to fetch and open. */
export type Pointer = { blob: string; key: string; sha256: string };

/**
 * `null` for an ordinary line of text. The panels use this to know whether a
 * decrypted message is a sentence or an attachment, and render it accordingly —
 * a wall of JSON in the feed is what the app itself would never show you.
 */
export function parsePointer(text: string): Pointer | null {
  try {
    const value = JSON.parse(text) as Partial<Pointer>;
    if (!value.blob || !value.key || !value.sha256) return null;
    return { blob: value.blob, key: value.key, sha256: value.sha256 };
  } catch {
    return null;
  }
}

function fromHex(hex: string): Bytes {
  const out = new Uint8Array(hex.length / 2) as Bytes;
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Seal the file, park it on the CDN, and record what the pointer will have to say.
 * Four Steps, three of them real calls, and the fourth an upload that is honest
 * about doing no cryptography at all.
 */
function encryptAndUploadAction(device: DeviceId): Action {
  const id = nextId(`${device}-attach`);
  const objectId = nextId("blob");
  return {
    id,
    label: `${device}.encryptAttachment(${ATTACHMENT_LABEL})`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)} generates a key for this one file`,
        op: "crypto.subtle.generateKey",
        crypto: "subtle",
        prose:
          "Straight from the CSPRNG. Look at what it is not derived from: no chain key, no root key, nothing that moves. The ratchet's whole design is that keys expire, and this key is built to do the opposite.",
        run: async (world) => {
          const key = await generateAesKey();
          const keyBytes = await exportAesKeyBytes(key);
          return {
            world: withMedia(world, device, {
              key,
              keyBytes,
              plaintext: attachmentBytes(),
            }),
            inputs: [
              { label: "algorithm", text: "AES-GCM, 256-bit" },
              {
                label: "file",
                text: `${ATTACHMENT_LABEL} · ${ATTACHMENT_BYTES.length} bytes`,
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "media key",
                  bytes: keyBytes,
                  note: "Never deleted. It has to still work the next time anyone scrolls back to this message.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} seals the file`,
        op: "crypto.subtle.encrypt",
        crypto: "subtle",
        prose:
          "AES-GCM over the whole file. The nonce is fixed for this key because the key is used exactly once — one key, one file, which is the only way a fixed nonce is ever safe.",
        run: async (world) => {
          const media = deviceOf(world, device).media!;
          const nonce = nonceFor(device, 0);
          const ciphertext = await sealAesGcm(
            media.key!,
            nonce,
            utf8(ATTACHMENT_LABEL),
            media.plaintext!,
          );
          return {
            world: withMedia(world, device, { ciphertext }),
            inputs: [
              { label: "plaintext (file)", bytes: media.plaintext! },
              { label: "media key", bytes: media.keyBytes! },
              { label: "nonce (iv)", bytes: nonce },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "ciphertext ‖ tag",
                  bytes: ciphertext,
                  note: "The file, plus the 16-byte GCM tag. The length of the original is not hidden and never is — and a length is most of what tells a photo from a video.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} digests the ciphertext`,
        op: "crypto.subtle.digest",
        crypto: "subtle",
        prose:
          "SHA-256 over the sealed bytes, not the file. This is what the recipient will check against what the CDN hands him — and the reason it means anything is that the digest travels inside a message Eve cannot touch.",
        run: async (world) => {
          const media = deviceOf(world, device).media!;
          const digest = await sha256(media.ciphertext!);
          return {
            world: withMedia(world, device, { digest }),
            inputs: [{ label: "ciphertext", bytes: media.ciphertext! }],
            outcome: {
              ok: true,
              values: [{ label: "sha-256", bytes: digest }],
            },
          };
        },
      }),
      step(id, {
        actor: "wire",
        title: "The blob is uploaded to a CDN",
        op: null,
        crypto: "none",
        prose:
          "No cryptography, and no end-to-end anything: this is an HTTP PUT to a bucket the messaging company rents. The operator now holds these bytes, learns their size and their timing, and is under no obligation to ever forget them.",
        run: async (world) => {
          const media = deviceOf(world, device).media!;
          const withBlob = withStored(world, {
            id: objectId,
            holder: "cdn",
            label: `${ATTACHMENT_LABEL}.enc`,
            bytes: media.ciphertext!,
            uploadedBy: device,
            note: "Ciphertext on a third-party CDN. Deleting the message deletes the pointer, not this.",
            swapped: false,
          });
          return {
            world: withMedia(withBlob, device, { objectId }),
            inputs: [{ label: "bytes", bytes: media.ciphertext! }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "object",
                  text: `cdn://${objectId}`,
                  note: "Anyone with the URL can download it. That is fine — without the key it is noise, and the key is not here.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/** Download, check the digest, then open the file. Split so a bad digest can abort. */
function fetchAndOpenActions(device: DeviceId, peer: DeviceId): Action[] {
  const checkId = nextId(`${device}-fetch`);
  const openId = nextId(`${device}-openfile`);

  /** The pointer as it actually arrived: read out of the message he decrypted. */
  const pointerOf = (world: World): Pointer => {
    const inbox = deviceOf(world, device).inbox;
    const last = inbox[inbox.length - 1];
    const pointer = last && parsePointer(last.text);
    if (!pointer) throw new Error("[e2ee] no attachment pointer in the inbox");
    return pointer;
  };

  return [
    {
      id: checkId,
      label: `${device}.fetchAttachment()`,
      actor: device,
      steps: [
        step(checkId, {
          actor: "wire",
          title: `${nameOf(device)} downloads the blob`,
          op: null,
          crypto: "none",
          prose:
            "A plain GET against the CDN. Nothing about this request is authenticated, and whatever comes back is whatever the operator felt like returning.",
          run: async (world) => {
            const pointer = pointerOf(world);
            const object = findStored(world, pointer.blob);
            return {
              world: withMedia(world, device, {
                ciphertext: object.bytes,
                objectId: object.id,
              }),
              inputs: [{ label: "url", text: `cdn://${pointer.blob}` }],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "bytes received",
                    bytes: object.bytes,
                    note: object.swapped
                      ? "These are not the bytes that were uploaded."
                      : "Unverified so far — bytes from a server, nothing more.",
                  },
                ],
              },
            };
          },
        }),
        step(checkId, {
          actor: device,
          title: `${nameOf(device)} checks the digest`,
          op: "crypto.subtle.digest",
          crypto: "subtle",
          prose:
            "SHA-256 over what arrived, compared with the digest that came inside the sealed message. A mismatch stops here: there is no point handing bytes of unknown origin to a decrypt call.",
          run: async (world) => {
            const pointer = pointerOf(world);
            const media = deviceOf(world, device).media!;
            const digest = await sha256(media.ciphertext!);
            const expected = fromHex(pointer.sha256);
            const matched = bytesEqual(digest, expected);
            const next = withMedia(world, device, {
              digest,
              digestMatched: matched,
            });
            if (matched) {
              return {
                world: next,
                inputs: [
                  { label: "downloaded bytes", bytes: media.ciphertext! },
                  { label: "expected sha-256", bytes: expected },
                ],
                outcome: {
                  ok: true,
                  values: [
                    {
                      label: "sha-256",
                      bytes: digest,
                      note: "Identical. These are the bytes she uploaded.",
                    },
                  ],
                },
              };
            }
            return {
              world: next,
              inputs: [
                { label: "downloaded bytes", bytes: media.ciphertext! },
                { label: "expected sha-256", bytes: expected },
                { label: "actual sha-256", bytes: digest },
              ],
              outcome: {
                ok: false,
                errorName: "DigestMismatch",
                errorMessage: `expected ${pointer.sha256.slice(0, 16)}…, got ${toHex(digest).slice(0, 16)}…`,
              },
              cancelActionIds: [openId],
            };
          },
        }),
      ],
    },
    {
      id: openId,
      label: `${device}.openAttachment()`,
      actor: device,
      steps: [
        step(openId, {
          actor: device,
          title: `${nameOf(device)} imports the media key`,
          op: "crypto.subtle.importKey",
          crypto: "subtle",
          prose:
            "The key came out of the message body — 32 bytes of hex inside a sealed message. This is the only thing standing between the CDN's copy and the photo.",
          run: async (world) => {
            const pointer = pointerOf(world);
            const keyBytes = fromHex(pointer.key);
            const key = await importAesKey(keyBytes);
            return {
              world: withMedia(world, device, { key, keyBytes }),
              inputs: [{ label: "raw key", bytes: keyBytes }],
              outcome: {
                ok: true,
                values: [
                  {
                    label: "media key",
                    text: "CryptoKey (AES-GCM)",
                    note: `Identical to ${nameOf(peer)}'s. It travelled inside the ratchet; the file did not.`,
                  },
                ],
              },
            };
          },
        }),
        step(openId, {
          actor: device,
          title: `${nameOf(device)} opens the file`,
          op: "crypto.subtle.decrypt",
          crypto: "subtle",
          prose:
            "AES-GCM again, and the tag check runs whether or not the digest did. Two independent integrity checks over the same bytes — belt and braces, because the blob came from somewhere neither device trusts.",
          run: async (world) => {
            const media = deviceOf(world, device).media!;
            const plaintext = await openAesGcm(
              media.key!,
              nonceFor(peer, 0),
              utf8(ATTACHMENT_LABEL),
              media.ciphertext!,
            );
            return {
              world: withMedia(world, device, { plaintext }),
              inputs: [
                { label: "ciphertext", bytes: media.ciphertext! },
                { label: "media key", bytes: media.keyBytes! },
              ],
              outcome: {
                ok: true,
                values: [
                  {
                    label: `${ATTACHMENT_LABEL}`,
                    bytes: plaintext,
                    note: "Byte-identical to the file she picked. It went through a server that never held the key, and here it is.",
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
 * Sending an attachment, end to end: seal the file, upload it, send the pointer
 * through the ratchet, then fetch and open on the far side.
 */
export function attachmentActions(
  world: World,
  from: DeviceId,
  to: DeviceId,
  options: { firstMessage?: boolean } = {},
): Action[] {
  const upload = encryptAndUploadAction(from);
  const send = ratchetSendActions(world, from, to, `[${ATTACHMENT_LABEL}]`, {
    // The pointer cannot exist when this Action is built: the key and the digest
    // are produced by Steps above that have not run yet. So it is resolved from
    // the world at the moment the seal happens, which is also the moment it is true.
    resolveText: (current) => {
      const media = deviceOf(current, from).media!;
      const pointer: Pointer = {
        blob: media.objectId!,
        key: toHex(media.keyBytes!),
        sha256: toHex(media.digest!),
      };
      return JSON.stringify(pointer);
    },
    ...(options.firstMessage ? firstMessageOptions(from, to) : {}),
  });
  return [upload, ...send, ...fetchAndOpenActions(to, from)];
}

/**
 * The opening message *is* the attachment, so the whole trade is visible in one
 * play-through rather than waiting for the reader to find a button. It is also the
 * honest ordering: the pointer is a first message like any other, X3DH header and
 * all — the file is what makes it different, and the file went a different way.
 */
export function messagingL4Script(world: World): Action[] {
  return x3dhScript(world, (current) =>
    attachmentActions(current, ALICE, BOB, { firstMessage: true }),
  );
}

/**
 * L4 sends. A plain line of text is an L3 send; the attachment is offered as its
 * own move, because "send a file" is a different thing to do and looks like one.
 */
export function messagingL4SendActions(
  world: World,
  from: DeviceId,
  to: DeviceId,
  text: string,
): Action[] {
  if (text === ATTACHMENT_SEND) return attachmentActions(world, from, to);
  return messagingL3SendActions(world, from, to, text);
}

/** The sentinel the UI sends when the reader picks "attach a file" rather than typing. */
export const ATTACHMENT_SEND = " attachment";
