/**
 * The Wire — Eve's column, and the widest of the three.
 *
 * Everything here is public by construction. Her moves hang off the packet that is
 * actually in flight rather than sitting in a separate console, because attacking
 * a thing by touching the thing is the whole idea. Nothing she does is simulated:
 * a flipped byte fails a real GCM tag check, a replay is accepted only because L1
 * genuinely keeps no record of counters it has opened.
 */

import type { AttackKind } from "@/lib/e2ee/attacks";
import { ATTACK_HINTS, ATTACK_LABELS } from "@/lib/e2ee/attacks";
import type { ChangeSet } from "@/lib/e2ee/diff";
import type {
  Defence,
  DeviceId,
  Level,
  LevelInfo,
  Packet,
  Snapshot,
  Weakness,
} from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import {
  ActivityIcon,
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CloudIcon,
  CopyIcon,
  DatabaseIcon,
  EyeIcon,
  ImageIcon,
  FileSignatureIcon,
  HandshakeIcon,
  KeyIcon,
  KeyRoundIcon,
  LockIcon,
  MoonIcon,
  PackageIcon,
  RadioIcon,
  RepeatIcon,
  ReplaceIcon,
  ScissorsIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  SmartphoneIcon,
  UnlockIcon,
  UserXIcon,
  VenetianMaskIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { crackedOf } from "@/lib/e2ee/exposure";
import { usePortrait } from "./art";
import { ByteDialog } from "./byte-dialog";
import { useFlightAnchor } from "./flight";
import {
  Btn,
  ByteGlyph,
  Hex,
  INSPECTABLE,
  Label,
  Plate,
  ScrollPane,
  Tip,
  missionName,
} from "./ui";

const MOVE_ICONS: Record<AttackKind, typeof ZapIcon> = {
  tamper: ZapIcon,
  drop: ScissorsIcon,
  replay: RepeatIcon,
  compromise: SmartphoneIcon,
  substituteKey: ReplaceIcon,
  swapBlob: ImageIcon,
  crackBackup: DatabaseIcon,
  traceTraffic: ActivityIcon,
};

const ALL_MOVES: AttackKind[] = [
  "tamper",
  "drop",
  "replay",
  "compromise",
  "substituteKey",
  "swapBlob",
  "crackBackup",
  "traceTraffic",
];

const CARD_ICONS: Record<string, typeof ZapIcon> = {
  "l1-replay": RepeatIcon,
  "l1-no-fs": ClockIcon,
  "l1-no-identity": UserXIcon,
  "l2-no-identity": UserXIcon,
  "l2-no-skipped-keys": ShuffleIcon,
  "l2-metadata": RadioIcon,
  "l2-replay-dead": RepeatIcon,
  "l2-forward-secrecy": ClockIcon,
  "l3-signed-prekey": FileSignatureIcon,
  "l3-offline": MoonIcon,
  "l3-tofu": HandshakeIcon,
  "l3-metadata": RadioIcon,
  "l3-skipped-keys": ShuffleIcon,
  "l4-digest-catches-swap": ShieldCheckIcon,
  "l4-media-key-outlives": ClockIcon,
  "l4-cdn-holds-bytes": CloudIcon,
  "l4-forwarding-reuploads": CopyIcon,
  "l5-pin-entropy": KeyRoundIcon,
  "l5-backup-undoes-forward-secrecy": ClockIcon,
  "l5-provider-holds-it": ServerIcon,
  "l6-sender-sealed": VenetianMaskIcon,
  "l6-traffic-shape": ActivityIcon,
  "l6-delivery-still-known": RadioIcon,
  "l6-trust-the-server": ServerIcon,
};

/**
 * What Eve actually saw. For a sealed-sender envelope that is the envelope, not
 * the message inside it — `Packet.payload` stays the inner ciphertext because the
 * engine has to deliver it, and reading that field here would be this page lying
 * about what is on the wire.
 */
function wireBytes(packet: Packet) {
  return packet.envelope ?? packet.payload;
}

/**
 * Where on the lane a Packet sits, as a percentage of the lane's width. The
 * token is centred on this point, so the two ends stop short of the sockets
 * rather than overhanging them.
 */
function positionOf(packet: Packet, rightId: DeviceId): number {
  if (packet.status === "in-flight") return 50;
  return packet.to === rightId ? 88 : 12;
}

function startOf(packet: Packet, rightId: DeviceId): number {
  // A sealed envelope has no origin to fly from, as far as this column knows. It
  // appears at the delivery service and goes on to a destination.
  if (packet.hidesSender) return 50;
  return packet.from === rightId ? 88 : 12;
}

/**
 * The packet in transit, as an object that moves. Keyed on the Packet id by the
 * caller so a new Packet remounts and flies from its sender rather than sliding
 * over from wherever the last one stopped.
 */
function Token({ packet, rightId }: { packet: Packet; rightId: DeviceId }) {
  const target = positionOf(packet, rightId);
  const [left, setLeft] = useState(() => startOf(packet, rightId));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLeft(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      style={{ left: `${left}%` }}
      className={cn(
        "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-in-out motion-reduce:transition-none",
        packet.status === "dropped" && "opacity-40",
      )}
    >
      <div
        className={cn(
          "mn-frame bg-mn-raised flex items-center gap-2 border-2 px-2.5 py-1.5 shadow-lg",
          packet.tampered
            ? "border-mn-accent [--mn-tick:var(--color-mn-accent)]"
            : "border-mn-ink",
          packet.status === "in-flight" &&
            "shadow-[0_0_0_3px_var(--mn-accent-tint)]",
        )}
      >
        {packet.kind === "public-key" ? (
          <KeyIcon size={15} className="shrink-0" />
        ) : packet.kind === "prekey-bundle" ? (
          <PackageIcon size={15} className="shrink-0" />
        ) : packet.hidesSender ? (
          <VenetianMaskIcon size={15} className="shrink-0" />
        ) : (
          <LockIcon size={15} className="shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-mn-display text-sm tracking-[0.05em] text-mn-ink uppercase">
            {packet.kind === "public-key"
              ? "pubkey"
              : packet.kind === "prekey-bundle"
                ? "prekey bundle"
                : packet.hidesSender
                  ? "sealed envelope"
                  : "ciphertext"}
            {packet.replayOf && " · replay"}
            {packet.status === "dropped" && " · dropped"}
          </div>
          <Hex bytes={wireBytes(packet)} take={4} />
        </div>
        <span className="shrink-0 text-sm text-mn-dim">
          {packet.hidesSender ? "?→" : packet.from === rightId ? "←" : "→"}
        </span>
      </div>
    </div>
  );
}

/**
 * The lane a Packet crosses: a recessed channel with a socket at each end.
 *
 * It is a machined part rather than a hairline because it is the one place on
 * the page where something is *between* the two devices — Eve's whole claim on
 * the packet is that it has to pass through here.
 */
function Track({
  packet,
  rightId,
}: {
  packet: Packet | null;
  rightId: DeviceId;
}) {
  const anchor = useFlightAnchor("lane");
  return (
    <div
      ref={anchor}
      className="mn-frame mn-lane relative h-16 border-2 border-mn-line"
    >
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-mn-dim/60" />
      <Socket side="left" />
      <Socket side="right" />
      {packet ? (
        <Token key={packet.id} packet={packet} rightId={rightId} />
      ) : (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mn-display text-xs tracking-[0.1em] text-mn-dimmer uppercase">
          wire idle
        </div>
      )}
    </div>
  );
}

/** A lane endpoint — where a device plugs into the wire. */
function Socket({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center bg-mn-solid text-mn-on-solid",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <div className="size-1.5 bg-mn-accent" />
    </div>
  );
}

/**
 * One card, for a weakness this Level still has or a defence it claims.
 *
 * Three end states and they mean different things, so they are never conflated:
 * `demonstrated` — you ran the attack and watched it land or fail;
 * `deferred` — this Level cannot show it, and the Level that can is named;
 * `unanswered` — nothing here fixes it, which for metadata is simply the truth.
 */
function ChallengeCard({
  id,
  title,
  detail,
  tone,
  runnable,
  demonstrated,
  answeredBy,
  hint,
  onRun,
}: {
  id: string;
  title: string;
  detail: string;
  /** `weakness` — Eve's to win. `defence` — the Level's claim to keep. */
  tone: "weakness" | "defence";
  runnable: AttackKind | null;
  demonstrated: boolean;
  answeredBy: Level | null;
  hint: string | null;
  onRun: (attack: AttackKind) => void;
}) {
  const Icon = CARD_ICONS[id] ?? ZapIcon;
  const deferred = !runnable && answeredBy !== null;
  const unanswered = !runnable && answeredBy === null;
  // Clamped by default so the grid stays scannable, but never *only* clamped: a
  // card that states a weakness and then hides half the statement is the one
  // thing this column must not do.
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "mn-frame mn-etch flex flex-col border-2 p-2.5",
        deferred || unanswered
          ? "border-mn-dimmer bg-mn-surface [--mn-tick:transparent]"
          : demonstrated
            ? "border-mn-ink bg-mn-surface"
            : "border-mn-ink bg-mn-raised [--mn-tick:var(--color-mn-accent)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon
          size={18}
          className={deferred || unanswered ? "text-mn-dim" : "text-mn-accent"}
          strokeWidth={2}
        />
        {tone === "defence" && (
          <ShieldCheckIcon size={15} className="mt-0.5 shrink-0 text-mn-dim" />
        )}
      </div>
      <div className="mt-1.5 font-mn-display text-base tracking-[0.04em] text-mn-ink uppercase">
        {title}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="mt-0.5 cursor-pointer text-left text-sm leading-snug text-mn-dim hover:text-mn-ink"
      >
        <span className={cn("block", !expanded && "line-clamp-3")}>
          {detail}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 font-mn-display text-xs tracking-[0.08em] text-mn-dim uppercase">
          <ChevronDownIcon
            size={12}
            className={cn(
              "transition-transform motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
          {expanded ? "less" : "more"}
        </span>
      </button>

      {deferred ? (
        <div className="mt-2 flex items-center gap-1 font-mn-display text-xs tracking-[0.08em] text-mn-dim uppercase">
          <ClockIcon size={13} /> deferred → {missionName(answeredBy)}
        </div>
      ) : unanswered ? (
        <div className="mt-2 flex items-center gap-1 font-mn-display text-xs tracking-[0.08em] text-mn-dim uppercase">
          <RadioIcon size={13} /> nothing here fixes this
        </div>
      ) : demonstrated ? (
        <div className="mt-2 flex items-center gap-1 font-mn-display text-xs tracking-[0.08em] text-mn-ink uppercase">
          <CheckIcon size={13} />
          {tone === "defence" ? "held · you tried it" : "demonstrated"}
        </div>
      ) : (
        <Tip content={hint}>
          <Btn
            variant="primary"
            size="sm"
            disabled={Boolean(hint)}
            onClick={() => runnable && onRun(runnable)}
            className="mt-2 w-full justify-start"
          >
            ▶ {tone === "defence" ? "try to break it" : "run attack"}
          </Btn>
        </Tip>
      )}
    </div>
  );
}

export function Wire({
  snapshot,
  info,
  atFrontier,
  onAttack,
  attackHint,
  changes,
}: {
  snapshot: Snapshot;
  info: LevelInfo;
  atFrontier: boolean;
  onAttack: (kind: AttackKind) => void;
  /** Why a move is unavailable right now, if it is. */
  attackHint: (kind: AttackKind) => string | null;
  changes: ChangeSet;
}) {
  const { packets, stolen, store } = snapshot.world;
  const evePortrait = usePortrait("eve");
  // Direction on this page is spatial: the right-hand column decides which arrow
  // a packet gets. One id is enough for that; the rest of the world does not care.
  const rightId = snapshot.world.deviceOrder[1];
  const level: Level = snapshot.level;

  // The token shows whatever is in flight; failing that, the last thing to move,
  // so the track is never empty once the conversation has started.
  const inFlight = [...packets].reverse().find((p) => p.status === "in-flight");
  const recent = [...packets].reverse().find((p) => p.status !== "in-flight");
  const shown = inFlight ?? recent ?? null;

  // What has actually been attempted, read off the world rather than tracked. A
  // card turns over when the move has been *run* — whether it worked is the Level's
  // business, and the steps show it either way.
  const attempted: Record<AttackKind, boolean> = {
    replay: packets.some((p) => p.replayOf),
    tamper: packets.some((p) => p.tampered),
    drop: packets.some((p) => p.status === "dropped"),
    compromise: snapshot.actions.some((action) =>
      action.id.startsWith("eve-compromise"),
    ),
    substituteKey: snapshot.actions.some((action) =>
      action.id.startsWith("eve-substitute"),
    ),
    swapBlob: store.some((object) => object.swapped),
    crackBackup: snapshot.actions.some((action) =>
      action.id.startsWith("eve-crackbackup"),
    ),
    traceTraffic: snapshot.actions.some((action) =>
      action.id.startsWith("eve-trace"),
    ),
  };

  const runnableHere = (attack: AttackKind | undefined): AttackKind | null =>
    attack && info.attacks.includes(attack) ? attack : null;

  const cards: {
    key: string;
    id: string;
    title: string;
    detail: string;
    tone: "weakness" | "defence";
    attack: AttackKind | undefined;
    answeredBy: Level | null;
  }[] = [
    ...info.defences.map((defence: Defence) => ({
      key: defence.id,
      id: defence.id,
      title: defence.title,
      detail: defence.detail,
      tone: "defence" as const,
      attack: defence.attack,
      answeredBy: null,
    })),
    ...info.weaknesses.map((weakness: Weakness) => ({
      key: weakness.id,
      id: weakness.id,
      title: weakness.title,
      detail: weakness.detail,
      tone: "weakness" as const,
      attack: weakness.attack,
      answeredBy: weakness.answeredBy,
    })),
  ];

  return (
    <section className="flex min-h-0 flex-col border-mn-line bg-mn-surface">
      <header className="mn-etch flex items-center gap-3 border-b-2 border-mn-line bg-mn-surface px-4 py-2.5">
        <Plate tone="accent" portrait={evePortrait} alt="Eve">
          <EyeIcon size={24} />
        </Plate>
        <div className="min-w-0">
          <div className="font-mn-display text-lg tracking-[0.06em] text-mn-accent-text uppercase">
            the wire · eve
          </div>
          <div className="text-sm text-mn-dim">
            everything here is public — she keeps a copy of everything
          </div>
        </div>
        <div className="mn-frame ml-auto flex shrink-0 items-center gap-1.5 border-2 border-mn-ink bg-mn-raised px-2 py-1 font-mn-display text-sm uppercase">
          <ArchiveIcon size={14} /> loot ×
          {packets.length + stolen.length + store.length}
        </div>
      </header>

      <ScrollPane className="min-h-0 flex-1">
        <div className="flex flex-col">
          <div className="border-b-2 border-mn-line px-4 pt-3 pb-2">
            <Label className="mb-2">packet in transit</Label>
            <Track packet={shown} rightId={rightId} />

            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {ALL_MOVES.map((kind) => {
                const Icon = MOVE_ICONS[kind];
                const unavailable = !info.attacks.includes(kind);
                const hint = unavailable
                  ? kind === "substituteKey"
                    ? "Substituting a key needs a signature to defeat — it lands with Mission 03."
                    : kind === "swapBlob"
                      ? "There is no blob on a CDN until a mission sends a file. That is Mission 04."
                      : kind === "crackBackup"
                        ? "Nothing has been backed up yet. That is Mission 05."
                        : kind === "traceTraffic"
                          ? "Worth running once the sender is off the envelope. That is Mission 06."
                          : `Not available at ${level}.`
                  : attackHint(kind);
                return (
                  <Tip key={kind} content={hint ?? ATTACK_HINTS[kind]}>
                    <Btn
                      size="sm"
                      disabled={unavailable || Boolean(hint) || !atFrontier}
                      onClick={() => onAttack(kind)}
                    >
                      <Icon size={14} />
                      {ATTACK_LABELS[kind]}
                    </Btn>
                  </Tip>
                );
              })}
            </div>
          </div>

          <div className="border-b-2 border-mn-line px-4 py-2.5">
            <Label className="mb-2">
              {level} challenges ·{" "}
              {info.defences.length > 0
                ? "what it fixes, and what it still does not"
                : "break it to understand it"}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const runnable = runnableHere(card.attack);
                return (
                  <ChallengeCard
                    key={card.key}
                    id={card.id}
                    title={card.title}
                    detail={card.detail}
                    tone={card.tone}
                    runnable={runnable}
                    demonstrated={runnable ? attempted[runnable] : false}
                    answeredBy={card.answeredBy}
                    hint={runnable ? attackHint(runnable) : null}
                    onRun={onAttack}
                  />
                );
              })}
            </div>
          </div>

          {/*
          Kept apart from the captured packets on purpose. Everything above came
          off the wire, which is what encryption is supposed to leak. This came
          off a device, and what it is worth is the Level's answer, not Eve's.
        */}
          {stolen.length > 0 && (
            <div
              className={cn(
                "border-b-2 px-4 py-2.5",
                changes.fields.has("eve.stolen")
                  ? "border-mn-accent bg-mn-accent-tint/40"
                  : "border-mn-line",
              )}
            >
              <Label className="mb-2 flex items-center gap-1" tone="accent">
                <SmartphoneIcon size={13} /> stolen off a device
              </Label>
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {stolen.map((item) => (
                  <ByteDialog
                    key={item.id}
                    title={item.label}
                    kicker={`taken from ${item.from}`}
                    bytes={item.bytes}
                    format={item.format}
                    note={item.note}
                    trigger={
                      <button
                        type="button"
                        className={cn(
                          "mn-frame mn-etch flex h-12 w-full items-center gap-2 border-2 border-mn-accent bg-mn-accent-tint p-1.5 text-left [--mn-tick:var(--color-mn-accent)]",
                          INSPECTABLE,
                        )}
                      >
                        <KeyRoundIcon size={14} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mn-display text-sm tracking-[0.04em] uppercase">
                            {item.label}
                          </span>
                          <Hex bytes={item.bytes} take={4} />
                        </span>
                        <span className="flex size-8 shrink-0 items-center justify-center border-2 border-current/30 p-0.5">
                          <ByteGlyph bytes={item.bytes} />
                        </span>
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/*
          Neither wire traffic nor stolen goods: bytes somebody parked on a server
          and left there. They are in Eve's column because the operator's copy is
          hers for every purpose this page cares about — and because the thing worth
          noticing is that they do not move, expire, or belong to the conversation.
        */}
          {store.length > 0 && (
            <div className="border-b-2 border-mn-line px-4 py-2.5">
              <Label className="mb-2 flex items-center gap-1">
                <ServerIcon size={13} /> parked on a server
              </Label>
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {store.map((object) => {
                  const cracked = crackedOf(snapshot.world, object.id);
                  return (
                    <ByteDialog
                      key={object.id}
                      title={object.label}
                      kicker={`${object.holder} · uploaded by ${object.uploadedBy}`}
                      bytes={object.bytes}
                      format={
                        object.holder === "cdn"
                          ? "ciphertext ‖ 16-byte GCM tag · key not here"
                          : "sealed archive ‖ 16-byte GCM tag · PIN-derived key"
                      }
                      plaintext={cracked?.text}
                      note={object.note}
                      trigger={
                        <button
                          type="button"
                          className={cn(
                            "mn-frame mn-etch flex h-12 w-full items-center gap-2 border-2 p-1.5 text-left",
                            INSPECTABLE,
                            object.swapped || cracked
                              ? "border-mn-accent bg-mn-accent-tint [--mn-tick:var(--color-mn-accent)]"
                              : "border-mn-dim bg-mn-raised hover:border-mn-ink",
                          )}
                        >
                          {object.holder === "cdn" ? (
                            <CloudIcon size={14} className="shrink-0" />
                          ) : (
                            <DatabaseIcon size={14} className="shrink-0" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              <span className="text-mn-dim">
                                {object.bytes.length} B
                              </span>
                              {object.swapped && (
                                <b className="text-mn-accent-text">
                                  {" "}
                                  · swapped
                                </b>
                              )}
                            </span>
                            {cracked ? (
                              <span className="block truncate font-mn-mono text-xs text-mn-accent-text">
                                {cracked.text.replace(/\s+/g, " ")}
                              </span>
                            ) : (
                              <Hex bytes={object.bytes} take={4} />
                            )}
                          </span>
                          <span className="flex size-8 shrink-0 items-center justify-center border-2 border-current/30 p-0.5">
                            <ByteGlyph bytes={object.bytes} />
                          </span>
                        </button>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-4 py-2.5">
            <Label className="mb-2">eve's loot · captured packets</Label>
            {packets.length === 0 ? (
              <span className="text-sm text-mn-dimmer">
                nothing on the wire yet
              </span>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {packets.map((packet, index) => {
                  // One state, not two: either she has opened it and the plaintext is
                  // here, or she has not. "She holds the key that would open this" was
                  // a distinction nobody needed — so the engine runs the decrypt.
                  const cracked = crackedOf(snapshot.world, packet.id);
                  const seen = wireBytes(packet);
                  const kindLabel =
                    packet.kind === "public-key"
                      ? "pubkey"
                      : packet.kind === "prekey-bundle"
                        ? "bundle"
                        : packet.hidesSender
                          ? "envelope"
                          : "ciphertext";
                  return (
                    <ByteDialog
                      key={packet.id}
                      title={packet.label}
                      kicker={`packet #${index + 1} · ${packet.status}`}
                      bytes={seen}
                      format={
                        packet.kind === "public-key"
                          ? "raw public key"
                          : packet.kind === "prekey-bundle"
                            ? "length-prefixed: signing key ‖ identity key ‖ prekey ‖ signature ‖ one-time prekey"
                            : packet.hidesSender
                              ? "envelope ‖ 16-byte GCM tag · sender and header sealed inside"
                              : "ciphertext ‖ 16-byte GCM tag"
                      }
                      plaintext={cracked?.text}
                      note={
                        cracked
                          ? "Eve ran decrypt on these bytes with the key she took off the device. The ciphertext was never the weak part — the key outliving the message is."
                          : packet.tampered
                            ? "Eve altered these bytes. The recipient's decrypt call is what decides whether that matters."
                            : packet.replayOf
                              ? "A byte-for-byte re-send of an earlier packet. Validly encrypted, because it genuinely was."
                              : undefined
                      }
                      trigger={
                        <button
                          type="button"
                          className={cn(
                            "mn-frame mn-etch flex h-12 w-full items-center gap-2 border-2 p-1.5 text-left",
                            INSPECTABLE,
                            cracked
                              ? "border-mn-accent bg-mn-accent-tint [--mn-tick:var(--color-mn-accent)]"
                              : packet.tampered || packet.replayOf
                                ? "bg-mn-raised border-mn-accent [--mn-tick:var(--color-mn-accent)]"
                                : "bg-mn-raised border-mn-dim hover:border-mn-ink",
                            packet.status === "dropped" && "opacity-50",
                            changes.packets.has(packet.id) &&
                              "border-mn-accent bg-mn-accent-tint",
                          )}
                        >
                          {cracked ? (
                            <UnlockIcon size={14} className="shrink-0" />
                          ) : packet.kind === "public-key" ? (
                            <KeyIcon size={14} className="shrink-0" />
                          ) : packet.kind === "prekey-bundle" ? (
                            <PackageIcon size={14} className="shrink-0" />
                          ) : packet.hidesSender ? (
                            <VenetianMaskIcon size={14} className="shrink-0" />
                          ) : (
                            <LockIcon size={14} className="shrink-0" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              <b className="font-mn-mono">#{index + 1}</b>{" "}
                              <span
                                className={
                                  cracked
                                    ? "text-mn-accent-text"
                                    : "text-mn-dim"
                                }
                              >
                                {kindLabel}{" "}
                                {packet.hidesSender
                                  ? `?→${packet.to === rightId ? "B" : "A"}`
                                  : packet.from === rightId
                                    ? "B→A"
                                    : "A→B"}
                              </span>
                            </span>
                            {/* The recovered sentence replaces the hex: that is the loss. */}
                            {cracked ? (
                              <span className="block truncate font-mn-mono text-xs text-mn-accent-text">
                                “{cracked.text}”
                              </span>
                            ) : (
                              <Hex bytes={seen} take={4} />
                            )}
                          </span>
                          {/* The captured bytes themselves, as the item's face. */}
                          <span className="flex size-8 shrink-0 items-center justify-center border-2 border-current/30 p-0.5">
                            <ByteGlyph bytes={seen} />
                          </span>
                        </button>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollPane>
    </section>
  );
}
