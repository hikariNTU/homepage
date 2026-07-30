/**
 * The session engine: turn a Script into History, one Step at a time.
 *
 * Forward at the Frontier is live — `runNextStep` performs the real Web Crypto
 * call. Backwards is not this file's business at all: a Snapshot is never edited,
 * so the caller rewinds by reading an earlier one.
 */

import {
  MESSAGING_L1,
  messagingL1Script,
  sendActions as messagingL1SendActions,
} from "./scenarios/messaging-l1";
import { MESSAGING_L2, messagingL2Script } from "./scenarios/messaging-l2";
import {
  MESSAGING_L3,
  messagingL3Script,
  messagingL3SendActions,
} from "./scenarios/messaging-l3";
import { ratchetSendActions } from "./scenarios/ratchet";
import type {
  Action,
  ActionRecord,
  DeviceId,
  Level,
  LevelInfo,
  PendingStep,
  Snapshot,
  StepMeta,
  StepResult,
  World,
} from "./types";
import { initialWorld } from "./world";

export const LEVELS: LevelInfo[] = [MESSAGING_L1, MESSAGING_L2, MESSAGING_L3];

export function levelInfo(level: Level): LevelInfo {
  const info = LEVELS.find((candidate) => candidate.level === level);
  if (!info) throw new Error(`[e2ee] unknown level ${level}`);
  return info;
}

function scriptFor(level: Level, world: World): Action[] {
  switch (level) {
    case "L1":
      return messagingL1Script();
    case "L2":
      // The L2 Script stops after the root key: whichever device speaks first owes
      // a DH ratchet, and the Actions for that depend on the world at the time, so
      // the opening message is queued as a send like any other.
      return [
        ...messagingL2Script(),
        ...ratchetSendActions(world, "alice", L2_FIRST_MESSAGE),
      ];
    case "L3":
      return messagingL3Script(world);
  }
}

const L2_FIRST_MESSAGE = "hey bob, this key dies after one use";

/**
 * The Actions for one message, as this Level sends it. The world is needed because
 * from L2 the ratchet's position decides how many Steps a send takes.
 */
export function sendActionsFor(
  level: Level,
  world: World,
  from: DeviceId,
  text: string,
): Action[] {
  switch (level) {
    case "L1":
      return messagingL1SendActions(from, text);
    case "L2":
      return ratchetSendActions(world, from, text);
    case "L3":
      return messagingL3SendActions(world, from, text);
  }
}

function recordOf(action: Action): ActionRecord {
  return {
    id: action.id,
    label: action.label,
    actor: action.actor,
    stepIds: action.steps.map((step) => step.id),
  };
}

export function initialSnapshot(level: Level): Snapshot {
  const world = initialWorld(level);
  const script = scriptFor(level, world);
  return {
    index: 0,
    level,
    world,
    step: null,
    queue: script.flatMap((action) => action.steps),
    actions: script.map(recordOf),
  };
}

export function isAtEnd(snapshot: Snapshot): boolean {
  return snapshot.queue.length === 0;
}

export function nextStepOf(snapshot: Snapshot): PendingStep | null {
  return snapshot.queue[0] ?? null;
}

/** A PendingStep minus the work it does — what remains once it has run. */
function metaOf(step: PendingStep): StepMeta {
  return {
    id: step.id,
    actionId: step.actionId,
    actor: step.actor,
    title: step.title,
    op: step.op,
    crypto: step.crypto,
    prose: step.prose,
    standIn: step.standIn,
  };
}

/**
 * Run the next queued Step for real and return the Snapshot it produced. Throws
 * only on programming errors — a failed cryptographic operation is a legitimate
 * outcome and is recorded on the Step.
 */
export async function runNextStep(snapshot: Snapshot): Promise<Snapshot> {
  const step = snapshot.queue[0];
  if (!step) throw new Error("[e2ee] nothing queued to run");

  let result: StepResult;
  try {
    result = await step.run(snapshot.world);
  } catch (error) {
    const err = error as Error;
    result = {
      world: snapshot.world,
      inputs: [],
      outcome: {
        ok: false as const,
        errorName: err.name || "Error",
        errorMessage: err.message || String(error),
      },
    };
  }

  const cancelled = new Set(result.cancelActionIds ?? []);
  let queue = snapshot.queue.slice(1);
  let actions = snapshot.actions;
  if (cancelled.size > 0) {
    const cancelledStepIds = new Set(
      queue.filter((queued) => cancelled.has(queued.actionId)).map((q) => q.id),
    );
    queue = queue.filter((queued) => !cancelled.has(queued.actionId));
    actions = actions.filter(
      (action) =>
        !cancelled.has(action.id) ||
        action.stepIds.some((id) => !cancelledStepIds.has(id)),
    );
  }

  return {
    index: snapshot.index + 1,
    level: snapshot.level,
    world: result.world,
    step: { ...metaOf(step), inputs: result.inputs, outcome: result.outcome },
    queue,
    actions,
  };
}

/**
 * Add Actions to a Snapshot's queue. `"next"` puts them ahead of what is already
 * pending, which is what Eve wants: she acts on a Packet *before* it is delivered.
 */
export function queueActions(
  snapshot: Snapshot,
  actions: Action[],
  position: "next" | "end" = "end",
): Snapshot {
  const steps = actions.flatMap((action) => action.steps);
  return {
    ...snapshot,
    queue:
      position === "next"
        ? [...steps, ...snapshot.queue]
        : [...snapshot.queue, ...steps],
    actions:
      position === "next"
        ? insertRecords(snapshot, actions)
        : [...snapshot.actions, ...actions.map(recordOf)],
  };
}

/**
 * Keep the Action list in the same order as the queue: Eve's Actions belong just
 * after the Action currently being run, not at the end of the timeline.
 */
function insertRecords(snapshot: Snapshot, actions: Action[]): ActionRecord[] {
  const pendingHead = snapshot.queue[0];
  if (!pendingHead) return [...snapshot.actions, ...actions.map(recordOf)];
  const at = snapshot.actions.findIndex(
    (action) => action.id === pendingHead.actionId,
  );
  if (at < 0) return [...snapshot.actions, ...actions.map(recordOf)];
  return [
    ...snapshot.actions.slice(0, at),
    ...actions.map(recordOf),
    ...snapshot.actions.slice(at),
  ];
}
