/**
 * Mission select.
 *
 * The Levels used to be a row of chips in the header, which made a choice with
 * real consequences — it throws away the session and starts over with fresh keys
 * — look like a set of tabs. It also had nowhere to say what a Level *is*, so the
 * only way to find out was to lose your session finding out.
 *
 * A picker screen fixes both. Every mission states what it fixes, what it still
 * gets wrong, and how many of Eve's moves it can survive, before it is chosen.
 * The unbuilt ones are shown locked rather than hidden: the story does not stop
 * at L3, and a picker that ended there would say it does.
 *
 * "Mission", not "stage" — `stage` already names the three-column playfield in
 * this route, and one word cannot mean both.
 */

import { LEVELS } from "@/lib/e2ee/session";
import type { Level, LevelInfo } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { Dialog } from "radix-ui";
import {
  ChevronDownIcon,
  CrosshairIcon,
  LockIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Label, ScrollPane, missionNumber } from "./ui";

export function MissionSelect({
  level,
  onSelect,
}: {
  level: Level;
  onSelect: (level: Level) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = LEVELS.find((info) => info.level === level);
  const built = LEVELS.filter((info) => info.available).length;

  const choose = (next: Level) => {
    setOpen(false);
    // Selecting the mission you are already on would silently throw the session
    // away, which is not what clicking the highlighted card looks like it does.
    if (next !== level) onSelect(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="mn-frame flex cursor-pointer items-center gap-2.5 border-2 border-current px-2.5 py-1 text-left hover:bg-mn-bg/10">
        <span className="font-mn-mono text-xl leading-none font-bold text-mn-accent">
          {missionNumber(level)}
        </span>
        <span className="min-w-0">
          <span className="block text-xs leading-tight tracking-[0.12em] opacity-60">
            MISSION
          </span>
          <span className="block truncate font-mn-display text-sm leading-tight tracking-[0.04em] uppercase">
            {current?.title ?? level}
          </span>
        </span>
        <ChevronDownIcon size={15} className="shrink-0 opacity-70" />
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Portalled to `body`, so it carries `mn-dark` itself or falls back to
            the light ramp — see the token block in e2ee.css. */}
        <Dialog.Overlay className="mn-dark fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          // A definite height, for the reason spelled out in mission-brief.tsx:
          // a content-based height here leaves the scroll pane's viewport with
          // no definite height to be 100% of, so it grows instead of scrolling.
          className="mn-dark mn-frame fixed inset-4 z-50 m-auto flex h-[min(46rem,calc(100dvh-2rem))] w-[min(66rem,100%)] flex-col overflow-hidden border-2 border-mn-accent bg-mn-bg font-mn text-mn-ink shadow-2xl motion-safe:animate-mn-pop"
        >
          <header className="mn-etch flex flex-none items-center gap-4 border-b-2 border-mn-accent bg-mn-solid px-4 py-3 text-mn-on-solid">
            <CrosshairIcon
              size={20}
              className="shrink-0 text-mn-accent"
              strokeWidth={2.4}
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-mn-display text-lg tracking-[0.06em]">
                SELECT MISSION
              </h2>
              <p className="text-xs tracking-[0.05em] opacity-60">
                messaging · {built} of {LEVELS.length} built · switching starts
                over with fresh keys
              </p>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center border-2 border-current hover:bg-mn-bg/10"
            >
              <XIcon size={14} />
            </Dialog.Close>
          </header>

          <ScrollPane className="mn-stage min-h-0 flex-1">
            <div className="grid auto-rows-min gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {LEVELS.map((info) => (
                <MissionCard
                  key={info.level}
                  info={info}
                  active={info.level === level}
                  onChoose={choose}
                />
              ))}
            </div>
          </ScrollPane>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MissionCard({
  info,
  active,
  onChoose,
}: {
  info: LevelInfo;
  active: boolean;
  onChoose: (level: Level) => void;
}) {
  const locked = !info.available;
  const status = locked ? "locked" : active ? "active" : "ready";

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onChoose(info.level)}
      className={cn(
        "mn-frame flex cursor-pointer flex-col gap-2 border-2 p-3 text-left transition-colors motion-reduce:transition-none",
        active
          ? "border-mn-accent bg-mn-accent-tint [--mn-tick:var(--color-mn-accent)]"
          : locked
            ? "cursor-not-allowed border-mn-dimmer bg-mn-surface/40 opacity-55"
            : "border-mn-ink bg-mn-surface hover:border-mn-accent hover:bg-mn-raised",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "font-mn-mono text-3xl leading-none font-bold",
            active
              ? "text-mn-accent"
              : locked
                ? "text-mn-dimmer"
                : "text-mn-dim",
          )}
        >
          {missionNumber(info.level)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mn-display text-base leading-tight tracking-[0.02em]">
            {info.title}
          </span>
          <StatusChip status={status} />
        </span>
      </div>

      {/*
        Not clamped. A card that cuts its own summary mid-sentence makes the
        reader pick a mission on half a description, and the dialog scrolls
        anyway — the cost of a taller card is nothing next to that.
      */}
      <p className="text-sm leading-relaxed text-mn-dim">{info.summary}</p>

      {/*
        The three numbers are the honest shape of a mission: what it repairs,
        what it still gets wrong, and how much of Eve's repertoire it has an
        answer for. A locked mission has no attacks because no code runs there.
      */}
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t-2 border-mn-line pt-2 text-xs">
        <Stat
          icon={<ShieldCheckIcon size={13} />}
          value={info.defences.length}
          label="fixes"
          tone={info.defences.length > 0 ? "accent" : "dim"}
        />
        <Stat
          icon={<TriangleAlertIcon size={13} />}
          value={info.weaknesses.length}
          label={info.weaknesses.length === 1 ? "hole" : "holes"}
          tone="dim"
        />
        <Stat
          icon={<CrosshairIcon size={13} />}
          value={info.attacks.length}
          label="moves"
          tone="dim"
        />
      </div>
    </button>
  );
}

function StatusChip({ status }: { status: "active" | "ready" | "locked" }) {
  if (status === "locked") {
    return (
      <span className="mt-1 flex items-center gap-1 font-mn-display text-xs tracking-[0.06em] text-mn-dimmer uppercase">
        <LockIcon size={12} /> specified · not built
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-mn-display mt-1 flex items-center gap-1 text-xs tracking-[0.06em] uppercase",
        status === "active" ? "text-mn-accent-text" : "text-mn-dim",
      )}
    >
      {status === "active" ? (
        <>
          <span className="size-2 animate-mn-blink bg-mn-accent motion-reduce:animate-none" />
          in play
        </>
      ) : (
        "ready"
      )}
    </span>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "accent" | "dim";
}) {
  return (
    <span className="flex items-center gap-1">
      <span className={tone === "accent" ? "text-mn-accent" : "text-mn-dim"}>
        {icon}
      </span>
      <span className="font-mn-mono font-bold text-mn-ink">{value}</span>
      <Label tone="dim">{label}</Label>
    </span>
  );
}
