/**
 * The ⓘ, which used to be four paragraphs.
 *
 * Three of those paragraphs were the same whichever mission was loaded, and the
 * fourth was a single line of algorithm names — so the box implied that missions
 * differ by cipher, when they differ by shape. This shows the shape: the phases
 * in order, the calls inside each phase with what goes in and what comes out,
 * what is legible on the wire, and what the mission does and does not fix.
 *
 * A dialog rather than a popover because a pipeline needs width, and because
 * this is something a reader stops to study rather than glances at. The page
 * behind it is a Snapshot and does not move while it is open.
 *
 * The content is `BRIEF_BY_LEVEL` plus the mission's own `LevelInfo` — nothing
 * is written twice: the fixes and holes here are the same records the mission
 * picker shows, at full length rather than counted.
 */

import {
  BRIEF_BY_LEVEL,
  type BriefHop,
  type BriefPhase,
} from "@/lib/e2ee/briefs";
import { levelInfo } from "@/lib/e2ee/session";
import type { Level } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { Dialog } from "radix-ui";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EyeIcon,
  InfoIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Label, ScrollPane, missionNumber } from "./ui";

export function MissionBrief({ level }: { level: Level }) {
  const info = levelInfo(level);
  const brief = BRIEF_BY_LEVEL[level];

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="About this mission"
        className="flex size-7 cursor-pointer items-center justify-center border-2 border-current hover:bg-mn-bg/10"
      >
        <InfoIcon size={14} />
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Portalled to `body`, so it carries `mn-dark` itself — see e2ee.css. */}
        <Dialog.Overlay className="mn-dark fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          // `h-[…]`, not `max-h-[…]`, and that is the whole fix.
          //
          // A percentage height only resolves against a parent whose height is
          // definite. Give this dialog a content-based height — `h-fit`, or
          // plain `auto` with a `max-h` — and nothing below it has a definite
          // height either, so the `size-full` on Radix's scroll viewport
          // collapses to `auto`, the viewport grows to fit the pipeline, and
          // Radix measures no overflow: no scrollbar, no scrolling, and a card
          // that runs off the screen. A definite length here makes every height
          // below it definite too.
          className="mn-dark mn-frame fixed inset-4 z-50 m-auto flex h-[min(70rem,calc(100dvh-2rem))] w-[min(60rem,100%)] flex-col overflow-hidden border-2 border-mn-accent bg-mn-bg font-mn text-mn-ink shadow-2xl motion-safe:animate-mn-pop"
        >
          <header className="mn-etch flex flex-none items-center gap-4 border-b-2 border-mn-accent bg-mn-solid px-4 py-3 text-mn-on-solid">
            <span className="font-mn-mono text-3xl leading-none font-bold text-mn-accent">
              {missionNumber(level)}
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-mn-display text-lg tracking-[0.06em] uppercase">
                {info.title}
              </Dialog.Title>
              <p className="text-xs tracking-[0.05em] opacity-60">
                mission brief · every op below is one real crypto.subtle call
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
            <div className="flex flex-col gap-5 p-4">
              <div className="border-l-2 border-mn-accent pl-3">
                <p className="text-base leading-relaxed">{brief.premise}</p>
                {/*
                  The one-liner the old ⓘ was, kept for the reader who only
                  wanted that — under the premise rather than instead of it.
                */}
                <p className="mt-1 font-mn-mono text-xs leading-snug text-mn-dim">
                  {brief.params}
                </p>
              </div>

              <Section title="pipeline" hint="in the order the steps run">
                <div className="flex flex-col">
                  {brief.phases.map((phase, index) => (
                    <PhaseBlock
                      key={phase.id}
                      phase={phase}
                      index={index}
                      last={index === brief.phases.length - 1}
                    />
                  ))}
                </div>
              </Section>

              <Section title="on the wire" hint="what Eve reads without a key">
                <div className="flex flex-col gap-1.5">
                  {brief.wire.map((hop) => (
                    <HopRow key={hop.label} hop={hop} />
                  ))}
                </div>
              </Section>

              <div className="grid gap-4 lg:grid-cols-2">
                {info.defences.length > 0 && (
                  <Section
                    title="what this fixes"
                    hint="run the attack and watch it fail"
                  >
                    <div className="flex flex-col gap-2">
                      {info.defences.map((defence) => (
                        <Finding
                          key={defence.id}
                          tone="accent"
                          icon={<ShieldCheckIcon size={14} />}
                          title={defence.title}
                          detail={defence.detail}
                          tag={`answers mission ${missionNumber(defence.answers)}`}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                <Section
                  title="what it still gets wrong"
                  hint="named, not hidden"
                >
                  <div className="flex flex-col gap-2">
                    {info.weaknesses.map((weakness) => (
                      <Finding
                        key={weakness.id}
                        tone="dim"
                        icon={<TriangleAlertIcon size={14} />}
                        title={weakness.title}
                        detail={weakness.detail}
                        tag={
                          weakness.answeredBy
                            ? `fixed in mission ${missionNumber(weakness.answeredBy)}`
                            : "nothing here fixes this"
                        }
                      />
                    ))}
                  </div>
                </Section>
              </div>

              <Section title="visible whatever this mission does">
                <ul className="flex flex-col gap-1.5">
                  {brief.leaks.map((leak) => (
                    <li key={leak} className="flex gap-2 text-sm leading-snug">
                      <EyeIcon
                        size={14}
                        className="mt-0.5 shrink-0 text-mn-accent"
                      />
                      <span className="text-mn-dim">{leak}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/*
                The disclaimer the popover used to open with, kept last: it is
                the same on every mission, and a reader who came here to find out
                how Mission 05 works should not have to read past it first.
              */}
              <div className="border-t-2 border-mn-line pt-3 text-xs leading-relaxed text-mn-dim">
                <p>
                  Missions are viewpoints, not achievements — switch freely.
                  Each one restarts with fresh keys. Nothing on this page is
                  precomputed, mocked or drawn.
                </p>
                <p className="mt-1.5">
                  An explainer, not an implementation to depend on: not wire
                  compatible with Signal, MLS or OpenPGP, and it defends nothing
                  real. Where the platform lacks a primitive, a labelled
                  stand-in is used. English only.
                </p>
              </div>
            </div>
          </ScrollPane>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b-2 border-mn-line pb-1">
        <Label tone="ink">{title}</Label>
        {hint && <span className="text-xs text-mn-dimmer">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * One phase, and the connector down to the next.
 *
 * The connector is a real element rather than a border on the block, because
 * the gap it draws through is what makes the column read as a pipeline: blocks
 * stacked flush would be a list, and a list does not say "then".
 */
function PhaseBlock({
  phase,
  index,
  last,
}: {
  phase: BriefPhase;
  index: number;
  last: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "mn-frame border-2 bg-mn-surface p-3",
          // An inherited phase is context, not this mission's news: it runs, and
          // it was explained one mission ago.
          phase.inherited
            ? "border-mn-dimmer bg-mn-surface/40"
            : "border-mn-ink",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-mn-mono text-sm font-bold text-mn-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-mn-display text-base tracking-[0.02em] uppercase">
            {phase.title}
          </span>
          <span className="font-mn-mono text-xs text-mn-dim">
            {phase.actor}
          </span>
          {phase.repeats && <Chip tone="accent">{phase.repeats}</Chip>}
          {phase.inherited && (
            <Chip tone="dim">as mission {missionNumber(phase.inherited)}</Chip>
          )}
        </div>

        <p className="mt-1 text-sm leading-snug text-mn-dim">{phase.gist}</p>

        <div className="mt-2.5 flex flex-col gap-1.5">
          {phase.ops.map((op) => (
            <div
              key={`${op.op ?? "none"}-${op.out}`}
              className="border-2 border-mn-line bg-mn-raised p-2"
            >
              {/*
                Inputs, call, output on one wrapping line. Wrapping rather than a
                three-column grid on purpose: an input list is sometimes four
                items long and sometimes two words, and a grid would either
                squeeze the long ones or strand the short ones in a wide cell.
              */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {op.inputs.map((input) => (
                  <Chip key={input} tone="dim">
                    {input}
                  </Chip>
                ))}
                <ArrowRightIcon
                  size={14}
                  className="shrink-0 text-mn-dimmer"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "border-2 px-1.5 py-0.5 font-mn-mono text-xs",
                    op.op
                      ? "border-mn-accent bg-mn-accent-tint text-mn-ink"
                      : "border-dashed border-mn-dimmer text-mn-dim",
                  )}
                >
                  {op.op ?? "no call"}
                </span>
                <span className="font-mn-mono text-xs text-mn-dim">
                  {op.algo}
                </span>
                <ArrowRightIcon
                  size={14}
                  className="shrink-0 text-mn-dimmer"
                  aria-hidden="true"
                />
                <span className="font-mn-display text-sm tracking-[0.02em]">
                  {op.out}
                </span>
              </div>
              {op.note && (
                <p className="mt-1 text-sm leading-snug text-mn-dim">
                  {op.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {!last && (
        <div className="flex justify-center py-1" aria-hidden="true">
          <ArrowDownIcon size={16} className="text-mn-dimmer" />
        </div>
      )}
    </>
  );
}

const HOP_ICON = {
  forward: ArrowRightIcon,
  back: ArrowLeftIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
} as const;

const HOP_WHERE = {
  forward: "alice → bob",
  back: "bob → alice",
  up: "device → server",
  down: "server → device",
} as const;

function HopRow({ hop }: { hop: BriefHop }) {
  const Icon = HOP_ICON[hop.dir];
  return (
    <div className="mn-lane flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-2 border-mn-line p-2">
      <Icon size={15} className="shrink-0 text-mn-accent" aria-hidden="true" />
      <span className="font-mn-display text-sm tracking-[0.02em] uppercase">
        {hop.label}
      </span>
      <span className="font-mn-mono text-xs text-mn-dimmer">
        {HOP_WHERE[hop.dir]}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {hop.clear.map((field) => (
          <Chip key={field} tone="dim">
            {field}
          </Chip>
        ))}
        {hop.sealed.map((field) => (
          <Chip key={field} tone="sealed">
            {field}
          </Chip>
        ))}
      </span>
    </div>
  );
}

/**
 * Three weights, and the difference between the first two is the point of the
 * wire section: a dim chip is a field anyone reads, an accent-tinted one is a
 * field that needs a key. Nothing else on the page distinguishes them, because
 * on the wire itself nothing does either.
 */
function Chip({
  tone,
  children,
}: {
  tone: "dim" | "accent" | "sealed";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "border px-1.5 py-0.5 font-mn text-xs tracking-[0.02em]",
        tone === "dim" && "border-mn-line text-mn-dim",
        tone === "accent" && "border-mn-accent text-mn-accent-text uppercase",
        tone === "sealed" && "border-mn-accent bg-mn-accent-tint text-mn-ink",
      )}
    >
      {children}
    </span>
  );
}

function Finding({
  tone,
  icon,
  title,
  detail,
  tag,
}: {
  tone: "accent" | "dim";
  icon: ReactNode;
  title: string;
  detail: string;
  tag: string;
}) {
  return (
    <div
      className={cn(
        "border-2 p-2.5",
        tone === "accent"
          ? "border-mn-accent bg-mn-accent-tint"
          : "border-mn-line bg-mn-surface",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 shrink-0",
            tone === "accent" ? "text-mn-accent-text" : "text-mn-dim",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mn-display text-sm tracking-[0.02em]">
            {title}
          </div>
          <p className="mt-0.5 text-sm leading-snug text-mn-dim">{detail}</p>
          <div className="mt-1 font-mn-mono text-xs text-mn-dimmer">{tag}</div>
        </div>
      </div>
    </div>
  );
}
