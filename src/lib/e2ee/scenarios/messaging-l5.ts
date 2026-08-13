/**
 * L5 — backups.
 *
 * Everything up to here has been about the wire. This Level is about the place
 * end-to-end encryption actually ends for most people, which is nowhere near the
 * wire: the phone keeps your messages in the clear, because it has to show them
 * to you, and then it puts a copy somewhere you can get it back from after you
 * drop the phone in a canal.
 *
 * The archive is sealed — genuinely, AES-GCM, under a key from PBKDF2 — and it
 * changes almost nothing, because the input to that derivation is six digits. A
 * million candidates is not a number cryptography can defend. Every real product
 * that does this well knows it, and puts the security somewhere else entirely: a
 * piece of hardware that counts failed attempts and refuses the fifth. The
 * cryptography is not what is protecting the backup. A rate limiter is.
 *
 * And the rate limiter only exists in front of the *service*. Once the file is in
 * an attacker's hands, nothing counts anything.
 */

import {
  derivePbkdf2AesKey,
  exportAesKeyBytes,
  fromUtf8,
  importPbkdf2BaseKey,
  nonceFor,
  openAesGcm,
  PBKDF2_ITERATIONS,
  randomBytes,
  randomPin,
  sealAesGcm,
  utf8,
} from "../primitives";
import type {
  Action,
  Bytes,
  DeviceId,
  LevelInfo,
  StepValue,
  World,
} from "../types";
import {
  ALICE,
  BOB,
  deviceOf,
  nextId,
  withCracked,
  withStored,
  withVault,
} from "../world";
import { nameOf, step } from "./common";
import { messagingL3SendActions, x3dhScript } from "./messaging-l3";

export const MESSAGING_L5: LevelInfo = {
  level: "L5",
  title: "Backups",
  summary:
    "Where end-to-end encryption actually ends for most people. The archive is sealed under a key derived from a short PIN, and the only thing standing between that PIN and an offline guessing run is a piece of hardware promising to count attempts.",
  available: true,
  defences: [],
  weaknesses: [
    {
      id: "l5-pin-entropy",
      title: "A six-digit PIN is a million guesses",
      detail:
        "No key derivation function makes that number large. PBKDF2 at 100 000 iterations multiplies the attacker's cost by a constant and multiplies yours by the same constant — and a constant times a million is still a number a laptop reaches. The security comes entirely from something outside the cryptography refusing to let anyone guess more than a handful of times, and from that thing being honest.",
      answeredBy: null,
      attack: "crackBackup",
    },
    {
      id: "l5-backup-undoes-forward-secrecy",
      title: "The backup undoes forward secrecy",
      detail:
        "Mission 02 spent itself deleting message keys so that old messages could not be recovered. The archive contains the messages themselves. Every property the ratchet bought is bypassed, not broken — the plaintext was sitting on the phone the whole time, because that is what a chat app is.",
      answeredBy: null,
    },
    {
      id: "l5-provider-holds-it",
      title: "The provider holds the file",
      detail:
        "Not a copy of the wire traffic — the actual history, in one object, with a name on it. Nothing about that requires a court order to be interesting, and the file does not expire when the conversation does.",
      answeredBy: null,
    },
  ],
  attacks: [
    "tamper",
    "drop",
    "replay",
    "compromise",
    "substituteKey",
    "crackBackup",
  ],
};

const L5_FIRST_MESSAGE = "pin is six digits, by the way";
const ARCHIVE_AAD = utf8("e2ee-visualiser/backup/v1");

/** Everything this device can still read, which is everything it ever showed you. */
function archiveOf(world: World, device: DeviceId): string {
  const self = deviceOf(world, device);
  const entries = [
    ...self.sentLog.map((sent) => ({
      direction: "sent" as const,
      with: sent.to,
      counter: sent.counter,
      text: sent.text,
    })),
    ...self.inbox.map((received) => ({
      direction: "received" as const,
      with: received.from,
      counter: received.counter,
      text: received.text,
    })),
  ];
  return JSON.stringify({ device, messages: entries }, null, 1);
}

/** The pin, salt and archive, sealed and handed to the provider. Five Steps. */
function backupAction(device: DeviceId): Action {
  const id = nextId(`${device}-backup`);
  const objectId = nextId("archive");
  return {
    id,
    label: `${device}.backUpToCloud()`,
    actor: device,
    steps: [
      step(id, {
        actor: device,
        title: `${nameOf(device)}'s phone assembles the history`,
        op: null,
        crypto: "none",
        prose:
          "No cryptography, and that is the finding. The message list is plaintext on the device — it has to be, or the app could not draw it — and this Step is a JSON dump of it. Nothing here is broken into; it is simply read.",
        run: async (world) => {
          const archive = utf8(archiveOf(world, device));
          const pin = randomPin();
          const salt = randomBytes(16);
          return {
            world: withVault(world, device, {
              archiveBytes: archive,
              pin,
              salt,
            }),
            inputs: [
              {
                label: "source",
                text: "the app's own message database",
                note: "The same rows it renders on screen.",
              },
            ],
            outcome: {
              ok: true,
              values: [
                {
                  label: "archive (plaintext)",
                  bytes: archive,
                  text: fromUtf8(archive),
                  note: "Readable. The ratchet deleted the keys; it never touched this.",
                },
                {
                  label: "backup PIN",
                  text: pin,
                  note: "Six digits, drawn from crypto.getRandomValues — so this one is not guessable by being obvious. It is guessable by being six digits.",
                },
                { label: "salt", bytes: salt },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} imports the PIN as key material`,
        op: "crypto.subtle.importKey",
        crypto: "subtle",
        prose:
          "Six ASCII bytes, imported as PBKDF2 input. Web Crypto does not care that this is a terrible secret — it is a key derivation function, not a judge of what you feed it.",
        run: async (world) => {
          const vault = deviceOf(world, device).vault!;
          const pinBytes = utf8(vault.pin!);
          await importPbkdf2BaseKey(pinBytes);
          return {
            world,
            inputs: [{ label: "PIN", bytes: pinBytes, text: vault.pin! }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "PBKDF2 base key",
                  text: "CryptoKey (non-extractable)",
                  note: "6 bytes of input. Around 20 bits of entropy, against a 256-bit key it is about to produce.",
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} stretches it into a key`,
        op: "crypto.subtle.deriveKey",
        crypto: "subtle",
        prose:
          "PBKDF2-SHA-256, 100 000 iterations. This is the entire defence, and the timing on your own machine is the argument against it: whatever this Step took, multiply by a million and you have the cost of trying every PIN. Divide by the number of cores an attacker rents.",
        run: async (world) => {
          const vault = deviceOf(world, device).vault!;
          const started = performance.now();
          const baseKey = await importPbkdf2BaseKey(utf8(vault.pin!));
          const backupKey = await derivePbkdf2AesKey(baseKey, vault.salt!);
          const elapsed = performance.now() - started;
          const backupKeyBytes = await exportAesKeyBytes(backupKey);
          const wholeSpaceMinutes = (elapsed * 1_000_000) / 60_000;
          return {
            world: withVault(world, device, { backupKey, backupKeyBytes }),
            inputs: [
              { label: "iterations", text: PBKDF2_ITERATIONS.toLocaleString() },
              { label: "hash", text: "SHA-256" },
              { label: "salt", bytes: vault.salt! },
            ],
            outcome: {
              ok: true,
              values: [
                { label: "backup key", bytes: backupKeyBytes },
                {
                  label: "measured cost",
                  text: `${elapsed.toFixed(0)} ms for one derivation`,
                  note: `All 1 000 000 PINs at this rate: about ${wholeSpaceMinutes.toFixed(0)} minutes on this machine, single-threaded, in a browser. A GPU is not single-threaded and is not a browser.`,
                },
              ],
            },
          };
        },
      }),
      step(id, {
        actor: device,
        title: `${nameOf(device)} seals the archive`,
        op: "crypto.subtle.encrypt",
        crypto: "subtle",
        prose:
          "Real AES-GCM under a real 256-bit key. Nothing about this step is weak. The weakness was already committed two steps ago and no amount of good cipher fixes it.",
        run: async (world) => {
          const vault = deviceOf(world, device).vault!;
          const ciphertext = await sealAesGcm(
            vault.backupKey!,
            nonceFor(device, 0),
            ARCHIVE_AAD,
            vault.archiveBytes!,
          );
          return {
            world: withVault(world, device, {
              objectId,
              sealedArchive: ciphertext,
            }),
            inputs: [
              { label: "archive", bytes: vault.archiveBytes! },
              { label: "backup key", bytes: vault.backupKeyBytes! },
            ],
            outcome: {
              ok: true,
              values: [{ label: "sealed archive", bytes: ciphertext }],
            },
          };
        },
      }),
      step(id, {
        actor: "wire",
        title: "The archive is uploaded to the provider",
        op: null,
        crypto: "none",
        prose:
          "Named, dated, and attached to an account. In a real product a hardware security module now stands in front of it and will refuse the fifth wrong PIN. That promise is worth exactly as much as the operator's ability to keep it — and it protects the service, not the file.",
        run: async (world) => {
          const vault = deviceOf(world, device).vault!;
          const ciphertext = vault.sealedArchive!;
          return {
            world: withStored(world, {
              id: objectId,
              holder: "backup",
              label: `${device}-chat-backup.enc`,
              bytes: ciphertext,
              uploadedBy: device,
              note: "Sealed under a six-digit PIN. Held by the provider, indefinitely.",
              swapped: false,
            }),
            inputs: [{ label: "bytes", bytes: ciphertext }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "object",
                  text: `backup://${objectId}`,
                  note: "The salt travels with it, as it must — a salt is not a secret.",
                },
              ],
            },
          };
        },
      }),
    ],
  };
}

/**
 * How many PINs the guessing run actually tries.
 *
 * Small on purpose: each one is a genuine PBKDF2 derivation at 100 000 iterations
 * followed by a genuine decrypt, and this runs in the reader's browser. The number
 * that matters is not this one — it is the measured cost per guess, which is real,
 * multiplied by the million a real attacker would work through.
 */
const GUESS_BUDGET = 24;

const GUESS_STAND_IN =
  "A real offline search enumerates 000000 upward until it hits, up to a million times. This page will not spend an hour of your laptop's life proving a number. So the run below tries 24 candidates with the true PIN planted at a random position among them — and everything else about it is real: 24 genuine PBKDF2 derivations, 24 genuine AES-GCM decrypt attempts, 23 of which fail because the key is wrong, and a measured per-guess cost you can multiply yourself.";

/** Candidate PINs: random decoys, with the real one somewhere in the pile. */
function candidatePins(truth: string): string[] {
  const pins = new Set<string>();
  while (pins.size < GUESS_BUDGET - 1) {
    const guess = randomPin();
    if (guess !== truth) pins.add(guess);
  }
  const list = [...pins];
  list.splice(
    crypto.getRandomValues(new Uint32Array(1))[0] % (list.length + 1),
    0,
    truth,
  );
  return list;
}

/**
 * Eve's move: take the file from the provider and guess.
 *
 * Note what she does not need. No device is stolen, no packet is captured, no
 * cryptography is broken. The archive is an object on a server, and the secret
 * protecting it is short.
 */
export function crackBackupAction(world: World): Action[] {
  const object = world.store.find((entry) => entry.holder === "backup");
  if (!object) return [];
  const owner = object.uploadedBy;
  const id = nextId("eve-crackbackup");

  return [
    {
      id,
      label: `eve.crackBackup(${object.label})`,
      actor: "eve",
      steps: [
        step(id, {
          actor: "eve",
          title: "Eve takes the archive off the provider",
          op: null,
          crypto: "none",
          prose:
            "However she gets it — a breach, a subpoena, an insider, a misconfigured bucket. The point is that this is one file with a name on it, and the attempt counter that guards the restore flow is not in the room once she has a copy.",
          run: async (current) => ({
            world: current,
            inputs: [{ label: "object", text: `backup://${object.id}` }],
            outcome: {
              ok: true,
              values: [
                {
                  label: "sealed archive",
                  bytes: object.bytes,
                  note: "Nothing readable yet. She now has unlimited attempts at it, on her own hardware, with nobody counting.",
                },
              ],
            },
          }),
        }),
        step(id, {
          actor: "eve",
          title: `Eve tries ${GUESS_BUDGET} PINs`,
          op: `crypto.subtle.deriveKey ×${GUESS_BUDGET}`,
          crypto: "subtle",
          standIn: GUESS_STAND_IN,
          prose:
            "Each guess is a full PBKDF2 derivation and an AES-GCM decrypt. The wrong ones throw OperationError, which is the tag check doing its job and telling her nothing except 'not this one'. That is all a brute-force search ever needs to be told.",
          run: async (current) => {
            const vault = deviceOf(current, owner).vault!;
            const candidates = candidatePins(vault.pin!);
            const started = performance.now();
            let found: { pin: string; plaintext: Bytes } | null = null;
            let tried = 0;

            for (const candidate of candidates) {
              tried += 1;
              const baseKey = await importPbkdf2BaseKey(utf8(candidate));
              const key = await derivePbkdf2AesKey(baseKey, vault.salt!);
              try {
                const plaintext = await openAesGcm(
                  key,
                  nonceFor(owner, 0),
                  ARCHIVE_AAD,
                  object.bytes,
                );
                found = { pin: candidate, plaintext };
                break;
              } catch {
                // Wrong key. The GCM tag refuses, and the search moves on.
              }
            }

            const elapsed = performance.now() - started;
            const perGuess = elapsed / tried;
            const hours = (perGuess * 1_000_000) / 3_600_000;
            const measured: StepValue[] = [
              {
                label: "measured",
                text: `${tried} guesses in ${elapsed.toFixed(0)} ms · ${perGuess.toFixed(0)} ms each`,
                note: `One thread in a browser tab would work through all 1 000 000 PINs in about ${hours.toFixed(1)} hours. Rented hardware does not use one thread and does not use a browser.`,
              },
            ];

            if (!found) {
              return {
                world: current,
                inputs: [
                  { label: "sealed archive", bytes: object.bytes },
                  { label: "salt", bytes: vault.salt! },
                ],
                outcome: {
                  ok: false,
                  errorName: "NotInThisSample",
                  errorMessage: `${tried} of 1 000 000 candidates tried, none matched — which is what an interrupted search looks like, not a defence`,
                },
              };
            }

            const text = fromUtf8(found.plaintext);
            const cracked = withCracked(current, {
              packetId: object.id,
              plaintext: found.plaintext,
              text,
            });
            return {
              world: cracked,
              inputs: [
                { label: "sealed archive", bytes: object.bytes },
                { label: "salt", bytes: vault.salt! },
              ],
              outcome: {
                ok: true,
                values: [
                  ...measured,
                  { label: "PIN", text: found.pin },
                  {
                    label: "archive (plaintext)",
                    bytes: found.plaintext,
                    text,
                    note: "The whole conversation, including every message whose key the ratchet carefully deleted.",
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

/** L3's session, one message, and then the phone helpfully saves everything. */
export function messagingL5Script(world: World): Action[] {
  return [
    ...x3dhScript(world, (current) =>
      messagingL3SendActions(current, ALICE, BOB, L5_FIRST_MESSAGE, {
        firstMessage: true,
      }),
    ),
    backupAction(ALICE),
  ];
}

export { messagingL3SendActions as messagingL5SendActions };
