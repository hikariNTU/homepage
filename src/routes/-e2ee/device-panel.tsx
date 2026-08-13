/**
 * One Device, showing only what that Device knows.
 *
 * Key material is a fixed grid of slots rather than a list of labels, so an empty
 * slot reads as "not filled yet" instead of as a broken form — and filling one is
 * visible progress. Public material is outlined, private material is a solid ink
 * field: everything on the Wire is outlined by definition, which makes the
 * grammar an argument rather than decoration.
 */

import type { ChangeSet } from "@/lib/e2ee/diff";
import type {
  Bytes,
  DeviceId,
  DeviceState,
  ExecutedStep,
  Level,
} from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { nameOf } from "@/lib/e2ee/scenarios/common";
import {
  ATTACHMENT_LABEL,
  ATTACHMENT_SEND,
  imageDataUri,
  parsePointer,
} from "@/lib/e2ee/scenarios/messaging-l4";
import {
  AnchorIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  DatabaseIcon,
  FileIcon,
  FileSignatureIcon,
  FingerprintIcon,
  FlameIcon,
  ImageIcon,
  InboxIcon,
  KeyIcon,
  KeyRoundIcon,
  LockIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  StampIcon,
  TicketIcon,
  UserCheckIcon,
  UserIcon,
  VenetianMaskIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { usePortrait } from "./art";
import { ByteDialog } from "./byte-dialog";
import { useFlightAnchor } from "./flight";
import {
  ArtPlate,
  Btn,
  ConsequenceStrip,
  Hex,
  INSPECTABLE,
  Label,
  Plate,
  ScrollPane,
  Tip,
} from "./ui";

type SlotSpec = {
  /**
   * Where the bytes live. A plain key reads `DeviceState`; `ratchet.` and
   * `prekeys.` prefixes read the sub-object, which is where everything L2 and L3
   * add lives.
   */
  field: string;
  label: string;
  icon: typeof KeyIcon;
  kind: "public" | "private" | "derived";
  format: string;
  /** The call that fills this slot, shown while it is still empty. */
  next: string;
  note?: string;
  wide?: boolean;
  /** These bytes are an image and should be shown as one. */
  image?: boolean;
};

/** The sub-objects a slot path may address, by their prefix. */
const SLOT_GROUPS = ["ratchet", "prekeys", "media", "vault", "seal"] as const;

/** Read a slot's bytes, following one level of `ratchet.`/`prekeys.`/… if present. */
function bytesAt(device: DeviceState, field: string): Bytes | null {
  const [head, tail] = field.split(".");
  if (!tail) return (device[head as keyof DeviceState] as Bytes | null) ?? null;
  if (!(SLOT_GROUPS as readonly string[]).includes(head)) return null;
  const group = device[head as (typeof SLOT_GROUPS)[number]] as Record<
    string,
    unknown
  > | null;
  return (group?.[tail] as Bytes | null) ?? null;
}

const L1_SLOTS: SlotSpec[] = [
  {
    field: "publicKeyRaw",
    label: "public key",
    icon: KeyIcon,
    kind: "public",
    format: "raw · uncompressed point 0x04 ‖ X ‖ Y",
    next: "generateKey()",
    note: "Public. This is the only key material that ever travels.",
  },
  {
    field: "privateKeyBytes",
    label: "private key",
    icon: LockIcon,
    kind: "private",
    format: "pkcs8",
    next: "generateKey()",
    note: "Exported purely so this page can show you it exists. It is never placed in a packet — a dev-only assertion fails the build path if it ever is.",
  },
  {
    field: "peerPublicKeyRaw",
    label: "peer pubkey",
    icon: UserCheckIcon,
    kind: "public",
    format: "raw",
    next: "importKey()",
    note: "Unauthenticated: nothing signed this, so nothing proves whose key it is. That is Mission 01's third weakness.",
  },
  {
    field: "sharedSecret",
    label: "shared secret",
    icon: ZapIcon,
    kind: "derived",
    format: "32 bytes · ECDH P-256 output",
    next: "deriveBits()",
    note: "Both devices reach these exact bytes, and they never crossed the wire.",
  },
  {
    field: "messageKeyBytes",
    label: "message key · aes-gcm",
    icon: KeyRoundIcon,
    kind: "derived",
    format: "raw AES-256",
    next: "deriveKey()",
    note: "Static at Mission 01: derived once and reused for every message. Only the nonce moves. That is why Mission 01 has no forward secrecy.",
    wide: true,
  },
];

/** L2 replaces the one static message key with the ratchet's live state. */
const RATCHET_SLOTS: SlotSpec[] = [
  {
    field: "ratchet.rootKey",
    label: "root key",
    icon: AnchorIcon,
    kind: "derived",
    format: "32 bytes · HKDF output",
    next: "deriveBits()",
    note: "Never encrypts anything. It exists to be stepped forward every time the conversation changes direction, and each step makes every earlier key unreachable.",
  },
  {
    field: "ratchet.selfPublicRaw",
    label: "own ratchet key",
    icon: RefreshCwIcon,
    kind: "public",
    format: "raw · uncompressed point",
    next: "generateKey()",
    note: "Replaced on every change of direction. Its public half rides in the header of every message on this leg.",
  },
  {
    field: "ratchet.sendChainKey",
    label: "sending chain",
    icon: ArrowUpRightIcon,
    kind: "private",
    format: "32 bytes · HMAC key",
    next: "dhRatchet()",
    note: "Produces the next message key and then replaces itself. Empty means the next message owes a DH ratchet step first.",
  },
  {
    field: "ratchet.recvChainKey",
    label: "receiving chain",
    icon: ArrowDownLeftIcon,
    kind: "private",
    format: "32 bytes · HMAC key",
    next: "receive()",
    note: "Sits at a definite position. A message whose counter is behind it cannot be opened, which is what makes a replay fail here.",
  },
  {
    field: "messageKeyBytes",
    label: "live message key",
    icon: KeyRoundIcon,
    kind: "derived",
    format: "raw AES-256",
    next: "sign()",
    note: "Exists for the length of one AES-GCM call and is then deleted. If this slot is empty, that is the system working.",
    wide: true,
  },
];

/** L3's bundle, on top of the ratchet. */
const PREKEY_SLOTS: SlotSpec[] = [
  {
    field: "prekeys.signingPublicRaw",
    label: "identity signing key",
    icon: StampIcon,
    kind: "public",
    format: "raw · ECDSA P-256",
    next: "generateKey()",
    note: "Signs this device's prekeys. Real X3DH signs with the identity key itself; Web Crypto needs a separate ECDSA pair for that.",
  },
  {
    field: "prekeys.signedPreKeyPublicRaw",
    label: "signed prekey",
    icon: FileSignatureIcon,
    kind: "public",
    format: "raw · ECDH P-256",
    next: "generateKey()",
    note: "Medium-term, published in the bundle, and the one field the signature covers.",
  },
  {
    field: "prekeys.oneTimePreKeyPublicRaw",
    label: "one-time prekey",
    icon: TicketIcon,
    kind: "public",
    format: "raw · ECDH P-256",
    next: "generateKey()",
    note: "Consumed by exactly one incoming session and then destroyed.",
  },
  {
    field: "prekeys.ephemeralPublicRaw",
    label: "ephemeral key",
    icon: SparklesIcon,
    kind: "public",
    format: "raw · ECDH P-256",
    next: "x3dh()",
    note: "The initiator's side of X3DH. Its public half travels in the first message's header so the recipient can catch up offline.",
  },
  {
    field: "prekeys.safetyNumber",
    label: "safety number",
    icon: FingerprintIcon,
    kind: "derived",
    format: "SHA-256 over both identity keys",
    next: "digest()",
    note: "Compare this with the other device, out of band. It is the only thing that catches an Eve who replaced the whole bundle — signature included — because a signature cannot introduce two strangers.",
    wide: true,
  },
];

/**
 * L4's attachment lives entirely outside the ratchet, and the panel says so by
 * putting it in its own slots rather than among the chain keys.
 */
const MEDIA_SLOTS: SlotSpec[] = [
  {
    field: "media.keyBytes",
    label: "media key",
    icon: ImageIcon,
    kind: "private",
    format: "raw · AES-GCM-256, from the CSPRNG",
    next: "generateKey()",
    note: "Not derived from anything. Not deleted after use. It has to still open the file the next time someone scrolls back, which is exactly why stealing it is worth so much.",
  },
  {
    field: "media.digest",
    label: "blob digest",
    icon: FingerprintIcon,
    kind: "derived",
    format: "SHA-256 over the ciphertext",
    next: "digest()",
    note: "Travels inside the sealed message. It is the only reason a blob fetched from a server nobody trusts can be trusted.",
  },
  {
    field: "media.plaintext",
    label: "the file",
    icon: FileIcon,
    kind: "private",
    format: "PNG",
    next: "decrypt()",
    note: "Never on the wire in this form, and never on the CDN in this form. What you are looking at came out of a real decrypt call.",
    wide: true,
    image: true,
  },
];

/** L5: the plaintext history, and the six digits standing in front of it. */
const VAULT_SLOTS: SlotSpec[] = [
  {
    field: "vault.archiveBytes",
    label: "archive",
    icon: DatabaseIcon,
    kind: "private",
    format: "JSON · the app's own message list",
    next: "backUpToCloud()",
    note: "Plaintext, on the device, the whole time. The ratchet deleted keys; it never touched this.",
    wide: true,
  },
  {
    field: "vault.salt",
    label: "salt",
    icon: SparklesIcon,
    kind: "public",
    format: "16 random bytes",
    next: "backUpToCloud()",
    note: "Not a secret, and never was. It stops one precomputed table serving every account — nothing more.",
  },
  {
    field: "vault.backupKeyBytes",
    label: "backup key",
    icon: KeyRoundIcon,
    kind: "private",
    format: "PBKDF2-SHA-256 · 100 000 iterations",
    next: "deriveKey()",
    note: "256 bits derived from about 20. The width of the output says nothing about the width of the input.",
  },
];

/** L6: the second envelope, and the one field it takes off the outside. */
const SEAL_SLOTS: SlotSpec[] = [
  {
    field: "seal.ephemeralPublicRaw",
    label: "envelope key",
    icon: VenetianMaskIcon,
    kind: "public",
    format: "raw · ECDH P-256, one envelope only",
    next: "sealSender()",
    note: "The only thing about the sender that travels, and it names nobody.",
  },
  {
    field: "seal.envelopeKeyBytes",
    label: "envelope secret",
    icon: LockIcon,
    kind: "private",
    format: "AES-GCM-256 · separate from the ratchet",
    next: "deriveKey()",
    note: "Kept apart from the message keys on purpose: hiding metadata must not be able to hurt the conversation.",
  },
];

function slotsFor(level: Level): SlotSpec[] {
  switch (level) {
    case "L1":
      return L1_SLOTS;
    case "L2":
      return [...L1_SLOTS.slice(0, 4), ...RATCHET_SLOTS];
    case "L3":
      // No static public-key exchange at L3: identity travels in the bundle.
      return [L1_SLOTS[0], L1_SLOTS[1], ...PREKEY_SLOTS, ...RATCHET_SLOTS];
    // L4 upward are L3's session plus one idea, so they are L3's slots plus that
    // idea's — and the extra slots come first, because they are what is new.
    case "L4":
      return [...MEDIA_SLOTS, L1_SLOTS[0], L1_SLOTS[1], ...RATCHET_SLOTS];
    case "L5":
      return [...VAULT_SLOTS, L1_SLOTS[0], L1_SLOTS[1], ...RATCHET_SLOTS];
    case "L6":
      return [
        ...SEAL_SLOTS,
        L1_SLOTS[0],
        L1_SLOTS[1],
        ...PREKEY_SLOTS.slice(0, 2),
        ...RATCHET_SLOTS,
      ];
  }
}

function Slot({
  spec,
  bytes,
  changed,
  anchorRef,
}: {
  spec: SlotSpec;
  bytes: Bytes | null;
  changed: boolean;
  /** Registers this tile as a flight anchor, when it is one end of a flight. */
  anchorRef?: (element: HTMLElement | null) => void;
}) {
  const Icon = spec.icon;
  const filled = bytes !== null;
  const isPrivate = spec.kind === "private";
  // The one slot whose bytes are a picture. Showing it is the whole payoff of L4:
  // this image came out of a real `decrypt`, off a server that never held the key.
  const image = spec.image && bytes ? imageDataUri(bytes) : null;

  const body = (
    <button
      type="button"
      className={cn(
        // Fixed height on every tile is what makes this read as an inventory
        // rather than a form: a slot's size says nothing about its contents, so
        // the eye can scan the grid for what is filled.
        "mn-frame mn-etch flex w-full items-center gap-2 border-2 p-1.5 text-left",
        spec.wide ? "h-16" : "h-14",
        !filled &&
          "border-mn-dimmer text-mn-dim border-dashed [--mn-tick:transparent]",
        filled && INSPECTABLE,
        filled && !isPrivate && "border-mn-ink bg-mn-raised",
        filled && isPrivate && "border-mn-line bg-mn-solid text-mn-on-solid",
        changed &&
          "border-mn-accent bg-mn-accent-tint text-mn-accent-text shadow-[0_0_0_3px_var(--mn-accent-tint)] [--mn-tick:var(--color-mn-accent)]",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center border-2",
          !filled && "border-mn-dimmer border-dashed font-extrabold",
          filled && !isPrivate && "border-mn-ink",
          filled && isPrivate && "border-mn-bg",
          changed && "border-mn-accent bg-mn-accent text-white",
        )}
      >
        {filled ? <Icon size={14} /> : "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mn-display text-sm leading-tight tracking-[0.06em] uppercase">
          {spec.label}
        </div>
        {!filled ? (
          <div className="font-mn-mono text-xs">next: {spec.next}</div>
        ) : changed ? (
          <div className="font-mn-display text-xs tracking-[0.06em] uppercase">
            + new · this step
          </div>
        ) : isPrivate ? (
          <div className="font-mn text-xs tracking-[0.04em] text-mn-dimmer uppercase">
            never leaves device
          </div>
        ) : (
          <Hex bytes={bytes} take={spec.wide ? 10 : 5} />
        )}
      </div>
      {image ? (
        <img
          src={image}
          alt=""
          className="size-12 shrink-0 border-2 border-current/30 object-contain p-0.5"
        />
      ) : (
        <ArtPlate bytes={bytes} filled={filled} size={spec.wide ? 48 : 40}>
          <Icon size={spec.wide ? 22 : 18} className="opacity-90" />
        </ArtPlate>
      )}
    </button>
  );

  return (
    <div ref={anchorRef} className={cn(spec.wide && "col-span-2")}>
      {filled ? (
        <ByteDialog
          trigger={body}
          title={spec.label}
          kicker={spec.kind}
          bytes={bytes}
          format={spec.format}
          note={spec.note}
          preview={
            image ? (
              <img src={image} alt="" className="max-h-40 object-contain" />
            ) : undefined
          }
        />
      ) : (
        body
      )}
    </div>
  );
}

/**
 * What a decrypted message says, as the app would show it.
 *
 * An attachment's plaintext is a pointer — a blob id, a key and a digest — and
 * dumping that JSON into the feed was the page showing its own plumbing where a
 * chat client would show a paperclip. The pointer is still one tap away in the
 * step detail, which is where plumbing belongs.
 */
function FeedBody({ text }: { text: string }) {
  const pointer = parsePointer(text);
  if (!pointer) {
    return <div className="break-words text-mn-ink">{text}</div>;
  }
  return (
    <div className="mt-0.5 flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center border-2 border-mn-line bg-mn-surface">
        <ImageIcon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-mn-ink">{ATTACHMENT_LABEL}</span>
        <span className="block truncate font-mn-mono text-xs text-mn-dim">
          key + digest · blob is elsewhere
        </span>
      </span>
    </div>
  );
}

export function DevicePanel({
  device,
  level,
  atFrontier,
  canSend,
  onSend,
  changes,
  failure,
  align,
}: {
  device: DeviceState;
  level: Level;
  atFrontier: boolean;
  canSend: boolean;
  onSend: (from: DeviceId, text: string) => void;
  changes: ChangeSet;
  /** The selected Step, when it failed on this Device. */
  failure: ExecutedStep | null;
  align: "left" | "right";
}) {
  const [draft, setDraft] = useState("");
  const name = nameOf(device.id);
  const portrait = usePortrait(device.id);
  const wrote = (field: string) => changes.fields.has(`${device.id}.${field}`);
  const burned = device.ratchet?.burned ?? [];
  const slots = slotsFor(level);
  // A sealed packet leaves the tile holding the key that sealed it, and an opened
  // one lands on the feed. Both are the last tile of the grid and the stage foot.
  const outAnchor = useFlightAnchor(`tile:${device.id}:out`);
  const inAnchor = useFlightAnchor(`tile:${device.id}:in`);

  return (
    <section
      className={cn(
        "border-mn-line flex min-h-0 flex-col border-b-2 lg:border-b-0",
        align === "left" ? "lg:border-r-2" : "lg:border-l-2",
      )}
    >
      <header className="mn-etch flex items-center gap-3 border-b-2 border-mn-line bg-mn-surface px-4 py-2.5">
        <Plate portrait={portrait} alt={name}>
          <UserIcon size={24} />
        </Plate>
        <div className="min-w-0">
          <div className="font-mn-display text-lg tracking-[0.06em] text-mn-ink uppercase">
            {name}
          </div>
          {/* Was `{device.id}` — uppercased by the Label, which made it a second
              copy of the name directly under the name. Eve's panel states what
              her column is; this states what this one is. */}
          <div className="text-sm text-mn-dim">only what this device knows</div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-2 border-mn-line px-2 py-1 font-mn-mono text-sm text-mn-dim">
          tx {device.sendCounter} · rx {device.inbox.length}
        </div>
      </header>

      <ScrollPane className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-4 py-3">
          <Label>inventory · key material</Label>
          <div className="grid grid-cols-2 gap-2">
            {slots.map((spec, index) => (
              <Slot
                key={spec.field}
                spec={spec}
                bytes={bytesAt(device, spec.field)}
                changed={wrote(spec.field.split(".").pop()!)}
                anchorRef={index === slots.length - 1 ? outAnchor : undefined}
              />
            ))}
          </div>

          {burned.length > 0 && (
            <div className="flex flex-col gap-1 border-2 border-dashed border-mn-dimmer p-2">
              <Label className="flex items-center gap-1">
                <FlameIcon size={13} /> deleted · unrecoverable
              </Label>
              <div className="flex flex-wrap gap-1">
                {burned.map((entry, index) => (
                  <span
                    key={`${entry}-${index}`}
                    className="border-2 border-mn-dimmer px-1.5 py-0.5 font-mn-mono text-xs text-mn-dim line-through"
                  >
                    {entry}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-snug text-mn-dim">
                Each of these opened exactly one message and was then removed.
                The chain they came from only runs forward, so nothing on this
                device can produce them again.
              </p>
            </div>
          )}

          {failure && !failure.outcome.ok && (
            <ConsequenceStrip title="hit blocked · tag check failed">
              <div className="font-mn-mono text-xs text-mn-accent-text">
                {failure.outcome.errorName}
              </div>
              <div className="mt-0.5 text-sm leading-snug text-mn-ink">
                {failure.outcome.errorMessage}
              </div>
              <div className="mt-1 text-xs leading-snug text-mn-dim">
                The error Web Crypto actually threw. No plaintext was returned,
                so {name} learned nothing.
              </div>
            </ConsequenceStrip>
          )}
        </div>
      </ScrollPane>

      {/*
        The stage. It is deliberately mostly empty: this is the ground the flight
        animation crosses, and the panel needs somewhere for a packet to arrive
        that is not on top of the inventory. The feed sits at its foot, so an
        arriving message lands next to the plaintext it turns into.
      */}
      <div
        ref={inAnchor}
        className={cn(
          "mn-stage relative flex shrink-0 flex-col justify-end gap-1 border-t-2 px-4 py-2.5",
          wrote("inbox")
            ? "border-mn-accent [--mn-tick:var(--color-mn-accent)]"
            : "border-mn-line",
          "min-h-32 lg:min-h-40",
        )}
      >
        <Label
          className="flex items-center gap-1"
          tone={wrote("inbox") ? "accent" : "dim"}
        >
          <InboxIcon size={13} /> decrypted feed
        </Label>
        {device.inbox.length === 0 ? (
          <span className="text-sm text-mn-dimmer">
            nothing yet — no packet has been opened on this device
          </span>
        ) : (
          <ScrollPane className="max-h-24 w-full">
            <ul className="flex flex-col gap-1">
              {device.inbox.map((entry, index) => (
                <li
                  key={`${entry.packetId}-${index}`}
                  className={cn(
                    "mn-frame border-2 px-2 py-1 text-sm",
                    entry.wasReplay
                      ? "border-mn-accent bg-mn-accent-tint [--mn-tick:var(--color-mn-accent)]"
                      : "border-mn-line bg-mn-raised",
                  )}
                >
                  <div className="font-mn-mono text-xs text-mn-dim">
                    #{entry.counter} from {entry.from}
                    {entry.wasReplay && " · replay accepted"}
                  </div>
                  <FeedBody text={entry.text} />
                </li>
              ))}
            </ul>
          </ScrollPane>
        )}
      </div>

      <form
        className="mn-etch flex items-center gap-2 border-t-2 border-mn-line bg-mn-surface px-4 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onSend(device.id, draft.trim());
          setDraft("");
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            "font-mn-mono shrink-0 text-base font-bold",
            canSend ? "text-mn-accent" : "text-mn-dimmer",
          )}
        >
          &gt;
        </span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!canSend}
          placeholder={
            canSend
              ? "your move — it will really be encrypted"
              : atFrontier
                ? // From L2 the message key is deleted after every message on
                  // purpose, so its absence says nothing about being able to
                  // send. What is missing before the handshake is the session.
                  level === "L1"
                  ? "no message key yet — run the handshake"
                  : "no session yet — run the handshake"
                : "viewing history"
          }
          className="min-w-0 flex-1 border-2 border-mn-line bg-mn-raised px-2 py-1.5 font-mn-mono text-sm text-mn-ink outline-none placeholder:text-mn-dim focus-visible:border-mn-accent disabled:opacity-50"
        />
        <Tip
          content={
            canSend
              ? null
              : atFrontier
                ? level === "L1"
                  ? "Both devices need a derived message key first."
                  : "The handshake has to seed the ratchet first."
                : "Return to the latest step to send."
          }
        >
          <Btn
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSend || !draft.trim()}
          >
            <SendIcon size={14} /> send
          </Btn>
        </Tip>
        {/*
          Only Mission 04 has anywhere for a file to go. Sending one is a different act
          from typing a sentence — a different key, a different route, a different
          server — so it gets its own control rather than a magic word in the box.
        */}
        {level === "L4" && (
          <Tip content="Seals the file under its own key, uploads it to the CDN, and sends only a pointer.">
            <Btn
              type="button"
              size="sm"
              disabled={!canSend}
              onClick={() => onSend(device.id, ATTACHMENT_SEND)}
            >
              <ImageIcon size={14} /> attach
            </Btn>
          </Tip>
        )}
      </form>
    </section>
  );
}
