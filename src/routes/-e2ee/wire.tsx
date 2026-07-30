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
  Level,
  LevelInfo,
  Packet,
  Snapshot,
  Weakness,
} from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileSignatureIcon,
  HandshakeIcon,
  KeyIcon,
  LockIcon,
  MoonIcon,
  PackageIcon,
  RadioIcon,
  RepeatIcon,
  ReplaceIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  SmartphoneIcon,
  UserXIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ByteDialog } from "./byte-dialog";
import { Btn, Hex, Label, Plate, Tip } from "./ui";

const MOVE_ICONS: Record<AttackKind, typeof ZapIcon> = {
  tamper: ZapIcon,
  drop: ScissorsIcon,
  replay: RepeatIcon,
  compromise: SmartphoneIcon,
  substituteKey: ReplaceIcon,
};

const ALL_MOVES: AttackKind[] = [
  "tamper",
  "drop",
  "replay",
  "compromise",
  "substituteKey",
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
};

/** Where on the track a Packet sits, as a percentage from the left edge. */
function positionOf(packet: Packet): number {
  if (packet.status === "in-flight") return 50;
  return packet.to === "bob" ? 86 : 2;
}

function startOf(packet: Packet): number {
  return packet.from === "bob" ? 86 : 2;
}

/**
 * The packet in transit, as an object that moves. Keyed on the Packet id by the
 * caller so a new Packet remounts and flies from its sender rather than sliding
 * over from wherever the last one stopped.
 */
function Token({ packet }: { packet: Packet }) {
  const target = positionOf(packet);
  const [left, setLeft] = useState(() => startOf(packet));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLeft(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      style={{ left: `${left}%` }}
      className={cn(
        "absolute top-0 transition-[left] duration-700 ease-in-out motion-reduce:transition-none",
        packet.status === "dropped" && "opacity-40",
      )}
    >
      <div
        className={cn(
          "bg-mn-raised flex items-center gap-2 border-2 px-2.5 py-1.5 shadow-md",
          packet.tampered ? "border-mn-accent" : "border-mn-ink",
        )}
      >
        {packet.kind === "public-key" ? (
          <KeyIcon size={15} className="shrink-0" />
        ) : packet.kind === "prekey-bundle" ? (
          <PackageIcon size={15} className="shrink-0" />
        ) : (
          <LockIcon size={15} className="shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-mn text-[10px] font-extrabold tracking-[0.05em] text-mn-ink uppercase">
            {packet.kind === "public-key"
              ? "pubkey"
              : packet.kind === "prekey-bundle"
                ? "prekey bundle"
                : "ciphertext"}
            {packet.replayOf && " · replay"}
            {packet.status === "dropped" && " · dropped"}
          </div>
          <Hex bytes={packet.payload} take={4} />
        </div>
        <span className="shrink-0 text-[11px] text-mn-dim">
          {packet.from === "alice" ? "→" : "←"}
        </span>
      </div>
    </div>
  );
}

function Track({ packet }: { packet: Packet | null }) {
  return (
    <div className="relative h-14">
      <div className="absolute top-6 right-0 left-0 border-t-2 border-dashed border-mn-dim" />
      <div className="absolute top-4 left-0 size-3.5 bg-mn-ink" />
      <div className="absolute top-4 right-0 size-3.5 bg-mn-ink" />
      {packet ? (
        <Token key={packet.id} packet={packet} />
      ) : (
        <div className="absolute inset-x-0 top-1 text-center font-mn text-[10px] font-extrabold tracking-[0.1em] text-mn-dimmer uppercase">
          wire idle
        </div>
      )}
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

  return (
    <div
      className={cn(
        "flex flex-col border-2 p-2.5",
        deferred || unanswered
          ? "border-mn-dimmer bg-mn-surface"
          : demonstrated
            ? "border-mn-ink bg-mn-surface"
            : "border-mn-ink bg-mn-raised",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon
          size={18}
          className={deferred || unanswered ? "text-mn-dim" : "text-mn-accent"}
          strokeWidth={2}
        />
        {tone === "defence" && (
          <ShieldCheckIcon size={13} className="mt-0.5 shrink-0 text-mn-dim" />
        )}
      </div>
      <div className="mt-1.5 font-mn text-[11px] font-extrabold tracking-[0.04em] text-mn-ink uppercase">
        {title}
      </div>
      <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-mn-dim">
        {detail}
      </p>

      {deferred ? (
        <div className="mt-2 flex items-center gap-1 font-mn text-[9px] font-extrabold tracking-[0.08em] text-mn-dim uppercase">
          <ClockIcon size={11} /> deferred → {answeredBy}
        </div>
      ) : unanswered ? (
        <div className="mt-2 flex items-center gap-1 font-mn text-[9px] font-extrabold tracking-[0.08em] text-mn-dim uppercase">
          <RadioIcon size={11} /> nothing here fixes this
        </div>
      ) : demonstrated ? (
        <div className="mt-2 flex items-center gap-1 font-mn text-[9px] font-extrabold tracking-[0.08em] text-mn-ink uppercase">
          <CheckIcon size={11} />
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
  const { packets } = snapshot.world;
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
      <header className="flex items-center gap-3 border-b-2 border-mn-line px-4 py-2.5">
        <Plate tone="accent">
          <EyeIcon size={24} />
        </Plate>
        <div className="min-w-0">
          <div className="font-mn text-[15px] font-extrabold tracking-[0.06em] text-mn-accent-text uppercase">
            the wire · eve
          </div>
          <div className="text-[11px] text-mn-dim">
            everything here is public — she keeps a copy of everything
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-2 border-mn-ink bg-mn-raised px-2 py-1 font-mn text-[11px] font-extrabold uppercase">
          <ArchiveIcon size={12} /> loot ×{packets.length}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b-2 border-mn-line px-4 pt-3 pb-2">
          <Label className="mb-2">packet in transit</Label>
          <Track packet={shown} />

          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {ALL_MOVES.map((kind) => {
              const Icon = MOVE_ICONS[kind];
              const unavailable = !info.attacks.includes(kind);
              const hint = unavailable
                ? kind === "substituteKey"
                  ? "Substituting a key needs a signature to defeat — it lands with L3."
                  : `Not available at ${level}.`
                : attackHint(kind);
              return (
                <Tip key={kind} content={hint ?? ATTACK_HINTS[kind]}>
                  <Btn
                    size="sm"
                    disabled={unavailable || Boolean(hint) || !atFrontier}
                    onClick={() => onAttack(kind)}
                  >
                    <Icon size={12} />
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

        <div className="px-4 py-2.5">
          <Label className="mb-2">eve's loot · captured packets</Label>
          {packets.length === 0 ? (
            <span className="text-[11px] text-mn-dimmer">
              nothing on the wire yet
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {packets.map((packet, index) => (
                <ByteDialog
                  key={packet.id}
                  title={packet.label}
                  kicker={`packet #${index + 1} · ${packet.status}`}
                  bytes={packet.payload}
                  format={
                    packet.kind === "public-key"
                      ? "raw public key"
                      : packet.kind === "prekey-bundle"
                        ? "length-prefixed: signing key ‖ identity key ‖ prekey ‖ signature ‖ one-time prekey"
                        : "ciphertext ‖ 16-byte GCM tag"
                  }
                  note={
                    packet.tampered
                      ? "Eve altered these bytes. The recipient's decrypt call is what decides whether that matters."
                      : packet.replayOf
                        ? "A byte-for-byte re-send of an earlier packet. Validly encrypted, because it genuinely was."
                        : undefined
                  }
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        "bg-mn-raised flex cursor-pointer items-center gap-1.5 border-2 px-2 py-1 text-[11px] transition-colors motion-reduce:transition-none",
                        packet.tampered || packet.replayOf
                          ? "border-mn-accent"
                          : "border-mn-dim hover:border-mn-ink",
                        packet.status === "dropped" && "opacity-50",
                        changes.packets.has(packet.id) &&
                          "border-mn-accent bg-mn-accent-tint",
                      )}
                    >
                      {packet.kind === "public-key" ? (
                        <KeyIcon size={12} />
                      ) : packet.kind === "prekey-bundle" ? (
                        <PackageIcon size={12} />
                      ) : (
                        <LockIcon size={12} />
                      )}
                      <b className="font-mn-mono">#{index + 1}</b>
                      <span className="text-mn-dim">
                        {packet.kind === "public-key"
                          ? "pubkey"
                          : packet.kind === "prekey-bundle"
                            ? "bundle"
                            : "ciphertext"}{" "}
                        {packet.from === "alice" ? "A→B" : "B→A"}
                      </span>
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
