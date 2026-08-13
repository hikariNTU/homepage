/**
 * The footer: the only transport surface, plus the coarse layer over the Script.
 *
 * Checkpoints answer "where am I in the story", which a flat list of twenty Steps
 * never did. But hiding the Steps behind them would spend the one asset this page
 * has — every Step is exactly one real `crypto.subtle` call — so the bar expands
 * upward into the full rail instead. Collapsed by default, one click away.
 */

import type { Snapshot, StepMeta } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { Collapsible } from "radix-ui";
import {
  CheckIcon,
  ChevronUpIcon,
  ListIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
} from "lucide-react";
import type { Checkpoint } from "./checkpoints";
import { Rail } from "./rail";
import { Btn, Label, Tip } from "./ui";

export function QuestBar({
  history,
  frontier,
  cursor,
  checkpoints,
  nextStep,
  atFrontier,
  busy,
  playing,
  canStepForward,
  onSeek,
  onPrev,
  onNext,
  onTogglePlay,
  onReset,
}: {
  history: Snapshot[];
  frontier: Snapshot;
  cursor: number;
  checkpoints: Checkpoint[];
  /** The Step about to run, used for the one-line "what happens next". */
  nextStep: StepMeta | null;
  atFrontier: boolean;
  busy: boolean;
  playing: boolean;
  canStepForward: boolean;
  onSeek: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
}) {
  const view = history[cursor];
  const total = history.length - 1 + frontier.queue.length;

  return (
    <Collapsible.Root className="mn-etch flex-none border-t-2 border-mn-accent bg-mn-raised">
      <Collapsible.Content className="h-[46vh] border-b-2 border-mn-line">
        <Rail
          history={history}
          frontier={frontier}
          cursor={cursor}
          busy={busy}
          onSeek={onSeek}
          onRunNext={onNext}
        />
      </Collapsible.Content>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex gap-1">
          <Tip
            content={cursor === 0 ? "Already at the start." : "One step back."}
          >
            <Btn size="icon" disabled={cursor === 0} onClick={onPrev}>
              <SkipBackIcon size={15} />
            </Btn>
          </Tip>
          <Btn
            variant="primary"
            disabled={!canStepForward || busy}
            onClick={onNext}
            className="h-8"
          >
            {atFrontier ? "next move" : "step forward"}
            <PlayIcon size={14} />
          </Btn>
          <Tip content={playing ? "Pause." : "Play one step at a time."}>
            <Btn size="icon" disabled={!canStepForward} onClick={onTogglePlay}>
              {playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
            </Btn>
          </Tip>
          <Tip content="Start over. Fresh keys, empty wire.">
            <Btn size="icon" onClick={onReset}>
              <RotateCcwIcon size={15} />
            </Btn>
          </Tip>
        </div>

        <ol className="mn-frame mn-lane flex min-w-64 flex-1 items-start gap-0 border-2 border-mn-line px-3 py-1.5">
          {checkpoints.map((checkpoint, index) => (
            <li
              key={checkpoint.id}
              className="flex flex-1 items-start last:flex-none"
            >
              <button
                type="button"
                disabled={checkpoint.firstStepIndex === null}
                onClick={() =>
                  checkpoint.firstStepIndex !== null &&
                  onSeek(checkpoint.firstStepIndex)
                }
                className={cn(
                  "flex shrink-0 cursor-pointer flex-col items-start gap-1 disabled:cursor-default",
                  checkpoint.state === "todo" && "text-mn-dim",
                  checkpoint.state === "current" && "text-mn-accent-text",
                  checkpoint.state === "done" && "text-mn-ink",
                )}
              >
                {checkpoint.state === "done" ? (
                  <CheckIcon size={15} />
                ) : checkpoint.state === "current" ? (
                  <span className="size-3.5 animate-mn-blink bg-mn-accent motion-reduce:animate-none" />
                ) : (
                  <span className="size-3.5 border-2 border-mn-dimmer" />
                )}
                <span className="font-mn-display text-xs tracking-[0.06em] whitespace-nowrap uppercase">
                  {checkpoint.label}
                  {checkpoint.state === "current" && " ◀ you are here"}
                </span>
              </button>
              {index < checkpoints.length - 1 && (
                <span
                  className={cn(
                    "mx-2 mt-1.5 h-0.5 flex-1",
                    checkpoint.state === "done" ? "bg-mn-ink" : "bg-mn-dimmer",
                  )}
                />
              )}
            </li>
          ))}
        </ol>

        <div className="flex max-w-md min-w-56 flex-1 items-baseline gap-2 text-sm">
          {atFrontier && nextStep ? (
            <>
              <Label tone="accent" className="shrink-0">
                next ▶
              </Label>
              <span className="leading-snug text-mn-dim">
                {nextStep.title}
                {nextStep.op && (
                  <code className="font-mn-mono text-mn-ink">
                    {" "}
                    {nextStep.op}
                  </code>
                )}
              </span>
            </>
          ) : atFrontier ? (
            <span className="text-mn-dim">
              Script complete. Send a message, or let Eve have a turn.
            </span>
          ) : (
            <>
              <Label className="shrink-0">history</Label>
              <span className="leading-snug text-mn-dim">
                Nothing is being computed.{" "}
                {view.step?.title ?? "Start of the script."}
              </span>
            </>
          )}
        </div>

        <Collapsible.Trigger asChild>
          <Btn size="sm" className="group shrink-0">
            <ListIcon size={14} />
            <span className="font-mn-mono">
              {cursor}/{total}
            </span>
            steps
            <ChevronUpIcon
              size={14}
              className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            />
          </Btn>
        </Collapsible.Trigger>
      </div>
    </Collapsible.Root>
  );
}
