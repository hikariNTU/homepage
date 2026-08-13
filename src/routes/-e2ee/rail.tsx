/**
 * The narrative rail, as master–detail: one numbered list of Steps on the left
 * in strict script order, and the selected Step's prose and bytes in a fixed
 * pane on the right.
 *
 * The first version flowed the Actions into CSS columns, which read like a
 * newspaper — down one column, back up to the top of the next — for a Script
 * that is strictly sequential. And expanding a Step inline reflowed the whole
 * list around it. One column of rows, numbered 01–20, with the detail in its
 * own pane fixes both: order is unambiguous and the list never jumps.
 */

import type { ExecutedStep, Snapshot, StepMeta } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { CheckIcon, CircleIcon, PlayIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { StepDetail } from "./step-detail";
import { Btn, Label, ScrollPane } from "./ui";

/**
 * Only Eve gets a colour. Devices are deliberately not enumerated here — one
 * accent means "the adversary did this", and a per-device palette would spend
 * the page's single hue on something that is not a consequence.
 */
const ACTOR_STYLES: Record<string, string> = {
  eve: "text-mn-accent-text",
  wire: "text-mn-dim",
};

type Row = {
  stepId: string;
  number: number;
  actionLabel: string;
  actor: string;
  /** History index if executed, else null. */
  at: number | null;
  meta: StepMeta | ExecutedStep;
  executed: ExecutedStep | null;
  isNext: boolean;
};

export function Rail({
  history,
  frontier,
  cursor,
  busy,
  onSeek,
  onRunNext,
}: {
  history: Snapshot[];
  frontier: Snapshot;
  cursor: number;
  busy: boolean;
  onSeek: (index: number) => void;
  onRunNext: () => void;
}) {
  const currentRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const executedAt = new Map<string, number>();
  history.forEach((snapshot, index) => {
    if (snapshot.step) executedAt.set(snapshot.step.id, index);
  });
  const nextStepId = frontier.queue[0]?.id;
  const pendingById = new Map(frontier.queue.map((step) => [step.id, step]));

  let number = 0;
  const groups = frontier.actions.map((action) => ({
    action,
    rows: action.stepIds.flatMap((stepId): Row[] => {
      const at = executedAt.get(stepId) ?? null;
      const executed = at !== null ? (history[at].step ?? null) : null;
      const meta = executed ?? pendingById.get(stepId);
      if (!meta) return [];
      number += 1;
      return [
        {
          stepId,
          number,
          actionLabel: action.label,
          actor: action.actor,
          at,
          meta,
          executed,
          isNext: at === null && stepId === nextStepId,
        },
      ];
    }),
  }));
  const total = number;

  const selected =
    groups.flatMap((group) => group.rows).find((row) => row.at === cursor) ??
    null;

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <ScrollPane className="min-h-0 shrink-0 basis-2/5 border-b-2 border-mn-line md:max-w-96 md:basis-auto md:border-r-2 md:border-b-0 lg:w-96">
        <ol>
          {groups.map(({ action, rows }) => (
            <li key={action.id}>
              <h3
                className={cn(
                  "sticky top-0 z-10 border-b-2 border-mn-line bg-mn-raised px-3 py-1 font-mn-mono text-sm font-bold",
                  ACTOR_STYLES[action.actor] ?? "text-mn-ink",
                )}
              >
                {action.label}
              </h3>
              <ol>
                {rows.map((row) => {
                  const done = row.at !== null;
                  const isCurrent = done && row.at === cursor;
                  const failed = row.executed
                    ? !row.executed.outcome.ok
                    : false;

                  return (
                    <li
                      key={row.stepId}
                      ref={isCurrent ? currentRef : undefined}
                    >
                      <button
                        type="button"
                        disabled={
                          (!done && !row.isNext) || (row.isNext && busy)
                        }
                        onClick={() =>
                          done ? onSeek(row.at as number) : onRunNext()
                        }
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 border-l-2 px-3 py-1.5 text-left text-sm",
                          isCurrent
                            ? failed
                              ? "border-mn-accent bg-mn-accent-tint"
                              : "border-mn-ink bg-mn-surface"
                            : "border-transparent hover:bg-mn-surface",
                          !done && !row.isNext && "cursor-default opacity-40",
                        )}
                      >
                        <span className="w-5 shrink-0 font-mn-mono text-xs text-mn-dim">
                          {String(row.number).padStart(2, "0")}
                        </span>
                        <span className="shrink-0">
                          {failed ? (
                            <XIcon size={14} className="text-mn-accent" />
                          ) : done ? (
                            <CheckIcon size={14} className="text-mn-ink" />
                          ) : row.isNext ? (
                            <PlayIcon size={14} className="text-mn-accent" />
                          ) : (
                            <CircleIcon size={14} className="text-mn-dimmer" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-mn-ink",
                            isCurrent && "font-bold",
                          )}
                        >
                          {row.meta.title}
                        </span>
                        {row.meta.crypto === "subtle" && (
                          <span className="size-1.5 shrink-0 bg-mn-accent" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </ScrollPane>

      {/* `@container` so StepDetail can split in/out on its own width. */}
      <ScrollPane className="@container min-h-0 flex-1">
        <div className="px-4 py-3">
          {selected ? (
            <>
              <Label tone="dim">
                step {String(selected.number).padStart(2, "0")} / {total} ·{" "}
                {selected.actionLabel}
              </Label>
              <div className="mt-0.5 mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-mn-display text-lg text-mn-ink">
                  {selected.meta.title}
                </h4>
                <code
                  className={cn(
                    "font-mn-mono text-sm",
                    selected.meta.crypto === "subtle"
                      ? "text-mn-accent-text"
                      : "text-mn-dim",
                  )}
                >
                  {selected.meta.op ?? "no cryptography"}
                </code>
              </div>
              {selected.executed && <StepDetail step={selected.executed} />}
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Label tone="dim">start of the script</Label>
              <p className="max-w-md text-sm leading-relaxed text-mn-dim">
                Nothing has run yet. Each row on the left is one call — the ▶
                row is next. Red squares mark the rows that are real{" "}
                <code className="font-mn-mono">crypto.subtle</code> calls.
              </p>
              <Btn size="sm" disabled={busy} onClick={onRunNext}>
                <PlayIcon size={14} /> run the first step
              </Btn>
            </div>
          )}
        </div>
      </ScrollPane>
    </div>
  );
}
