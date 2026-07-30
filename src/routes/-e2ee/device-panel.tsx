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
import {
  AnchorIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  FileSignatureIcon,
  FingerprintIcon,
  FlameIcon,
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
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { ByteDialog } from "./byte-dialog";
import { Btn, ConsequenceStrip, Hex, Label, Plate, Tip } from "./ui";

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
};

/** Read a slot's bytes, following one level of `ratchet.`/`prekeys.` if present. */
function bytesAt(device: DeviceState, field: string): Bytes | null {
  const [head, tail] = field.split(".");
  if (!tail) return (device[head as keyof DeviceState] as Bytes | null) ?? null;
  const group =
    head === "ratchet"
      ? (device.ratchet as Record<string, unknown> | null)
      : (device.prekeys as Record<string, unknown> | null);
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
    note: "Unauthenticated: nothing signed this, so nothing proves whose key it is. That is L1's third weakness.",
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
    note: "Static at L1: derived once and reused for every message. Only the nonce moves. That is why L1 has no forward secrecy.",
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

function slotsFor(level: Level): SlotSpec[] {
  switch (level) {
    case "L1":
      return L1_SLOTS;
    case "L2":
      return [...L1_SLOTS.slice(0, 4), ...RATCHET_SLOTS];
    case "L3":
      // No static public-key exchange at L3: identity travels in the bundle.
      return [L1_SLOTS[0], L1_SLOTS[1], ...PREKEY_SLOTS, ...RATCHET_SLOTS];
  }
}

function Slot({
  spec,
  bytes,
  changed,
}: {
  spec: SlotSpec;
  bytes: Bytes | null;
  changed: boolean;
}) {
  const Icon = spec.icon;
  const filled = bytes !== null;
  const isPrivate = spec.kind === "private";

  const body = (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 border-2 p-2 text-left transition-colors motion-reduce:transition-none",
        spec.wide && "col-span-2",
        !filled && "border-mn-dimmer text-mn-dim border-dashed",
        filled && !isPrivate && "border-mn-ink bg-mn-raised cursor-pointer",
        filled &&
          isPrivate &&
          "border-mn-ink bg-mn-ink text-mn-bg cursor-pointer",
        changed &&
          "border-mn-accent bg-mn-accent-tint text-mn-accent-text animate-mn-halo motion-reduce:animate-none",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center border-2",
          !filled && "border-mn-dimmer border-dashed font-extrabold",
          filled && !isPrivate && "border-mn-ink",
          filled && isPrivate && "border-mn-bg",
          changed && "border-mn-accent bg-mn-accent text-white",
        )}
      >
        {filled ? <Icon size={15} /> : "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mn text-[10px] font-extrabold tracking-[0.06em] uppercase">
          {spec.label}
        </div>
        {!filled ? (
          <div className="font-mn-mono text-[10px]">next: {spec.next}</div>
        ) : changed ? (
          <div className="font-mn text-[9px] font-bold tracking-[0.06em] uppercase">
            + new · this step
          </div>
        ) : isPrivate ? (
          <div className="font-mn text-[9px] tracking-[0.04em] text-mn-dimmer uppercase">
            never leaves device
          </div>
        ) : (
          <Hex bytes={bytes} take={6} />
        )}
      </div>
    </button>
  );

  if (!filled) return body;

  return (
    <div className={cn(spec.wide && "col-span-2")}>
      <ByteDialog
        trigger={body}
        title={spec.label}
        kicker={spec.kind}
        bytes={bytes}
        format={spec.format}
        note={spec.note}
      />
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
  const name = device.id === "alice" ? "Alice" : "Bob";
  const wrote = (field: string) => changes.fields.has(`${device.id}.${field}`);
  const burned = device.ratchet?.burned ?? [];

  return (
    <section
      className={cn(
        "border-mn-line flex min-h-0 flex-col border-b-2 lg:border-b-0",
        align === "left" ? "lg:border-r-2" : "lg:border-l-2",
      )}
    >
      <header className="flex items-center gap-3 border-b-2 border-mn-line px-4 py-2.5">
        <Plate>
          <UserIcon size={24} />
        </Plate>
        <div className="min-w-0">
          <div className="font-mn text-[15px] font-extrabold tracking-[0.06em] text-mn-ink uppercase">
            {name}
          </div>
          <Label>{device.id}</Label>
        </div>
        <div className="ml-auto font-mn-mono text-[11px] text-mn-dim">
          tx {device.sendCounter} · rx {device.inbox.length}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        <Label>inventory · key material</Label>
        <div className="grid grid-cols-2 gap-2">
          {slotsFor(level).map((spec) => (
            <Slot
              key={spec.field}
              spec={spec}
              bytes={bytesAt(device, spec.field)}
              changed={wrote(spec.field.split(".").pop()!)}
            />
          ))}
        </div>

        {burned.length > 0 && (
          <div className="flex flex-col gap-1 border-2 border-dashed border-mn-dimmer p-2">
            <Label className="flex items-center gap-1">
              <FlameIcon size={11} /> deleted · unrecoverable
            </Label>
            <div className="flex flex-wrap gap-1">
              {burned.map((entry, index) => (
                <span
                  key={`${entry}-${index}`}
                  className="border-2 border-mn-dimmer px-1.5 py-0.5 font-mn-mono text-[10px] text-mn-dim line-through"
                >
                  {entry}
                </span>
              ))}
            </div>
            <p className="text-[10px] leading-snug text-mn-dim">
              Each of these opened exactly one message and was then removed. The
              chain they came from only runs forward, so nothing on this device
              can produce them again.
            </p>
          </div>
        )}

        {failure && !failure.outcome.ok && (
          <ConsequenceStrip title="hit blocked · tag check failed">
            <div className="font-mn-mono text-[10px] text-mn-accent-text">
              {failure.outcome.errorName}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-mn-ink">
              {failure.outcome.errorMessage}
            </div>
            <div className="mt-1 text-[10px] leading-snug text-mn-dim">
              The error Web Crypto actually threw. No plaintext was returned, so{" "}
              {name} learned nothing.
            </div>
          </ConsequenceStrip>
        )}

        <div
          className={cn(
            "mt-auto flex flex-col gap-1 pt-2",
            wrote("inbox") &&
              "border-mn-accent bg-mn-accent-tint -mx-1 border-2 px-1 py-1",
          )}
        >
          <Label className="flex items-center gap-1">
            <InboxIcon size={11} /> decrypted feed
          </Label>
          {device.inbox.length === 0 ? (
            <span className="text-[11px] text-mn-dimmer">nothing yet</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {device.inbox.map((entry, index) => (
                <li
                  key={`${entry.packetId}-${index}`}
                  className={cn(
                    "border-2 px-2 py-1 text-[12px]",
                    entry.wasReplay
                      ? "border-mn-accent bg-mn-accent-tint"
                      : "border-mn-line bg-mn-raised",
                  )}
                >
                  <div className="font-mn-mono text-[10px] text-mn-dim">
                    #{entry.counter} from {entry.from}
                    {entry.wasReplay && " · replay accepted"}
                  </div>
                  <div className="text-mn-ink">{entry.text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form
        className="flex gap-2 border-t-2 border-mn-line px-4 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onSend(device.id, draft.trim());
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!canSend}
          placeholder={
            canSend
              ? "your move — it will really be encrypted"
              : atFrontier
                ? "no message key yet — run the handshake"
                : "viewing history"
          }
          className="min-w-0 flex-1 border-2 border-mn-line bg-mn-raised px-2 py-1.5 text-[12px] text-mn-ink outline-none placeholder:text-mn-dim focus-visible:border-mn-accent disabled:opacity-50"
        />
        <Tip
          content={
            canSend
              ? null
              : atFrontier
                ? "Both devices need a derived message key first."
                : "Return to the latest step to send."
          }
        >
          <Btn
            type="submit"
            variant="primary"
            size="sm"
            disabled={!canSend || !draft.trim()}
          >
            <SendIcon size={12} /> send
          </Btn>
        </Tip>
      </form>
    </section>
  );
}
