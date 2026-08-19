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
import {
  MESSAGING_L4,
  messagingL4Script,
  messagingL4SendActions,
} from "./scenarios/messaging-l4";
import {
  MESSAGING_L5,
  messagingL5Script,
  messagingL5SendActions,
} from "./scenarios/messaging-l5";
import {
  MESSAGING_L6,
  messagingL6Script,
  messagingL6SendActions,
} from "./scenarios/messaging-l6";
import { ratchetSendActions } from "./scenarios/ratchet";
import { eveOpenAction } from "./attacks";
import { holdsSealingKey } from "./exposure";
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
import { ALICE, BOB, deviceOf, initialWorld } from "./world";

export const LEVELS: LevelInfo[] = [
  MESSAGING_L1,
  MESSAGING_L2,
  MESSAGING_L3,
  MESSAGING_L4,
  MESSAGING_L5,
  MESSAGING_L6,
];

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
        ...ratchetSendActions(world, ALICE, BOB, L2_FIRST_MESSAGE),
      ];
    case "L3":
      return messagingL3Script(world);
    case "L4":
      return messagingL4Script(world);
    case "L5":
      return messagingL5Script(world);
    case "L6":
      return messagingL6Script(world);
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
  to: DeviceId,
  text: string,
): Action[] {
  const send = (): Action[] => {
    switch (level) {
      case "L1":
        return messagingL1SendActions(from, to, text);
      case "L2":
        return ratchetSendActions(world, from, to, text);
      case "L3":
        return messagingL3SendActions(world, from, to, text);
      case "L4":
        return messagingL4SendActions(world, from, to, text);
      case "L5":
        return messagingL5SendActions(world, from, to, text);
      case "L6":
        return messagingL6SendActions(world, from, to, text);
    }
  };

  // Once Eve holds a key that never changes, reading the rest of the conversation
  // is not a further attack she has to launch — it is simply what she can do. So the
  // open rides along with the send, and the plaintext on her side is recovered by a
  // real `decrypt` like every other plaintext on the page.
  return holdsSealingKey(world, level) ? [...send(), eveOpenAction()] : send();
}

/**
 * Whether this device could send right now, at this Level.
 *
 * Not "does it hold a message key". At L1 that happens to be the same question —
 * one static key, never deleted — but from L2 the message key is *deleted after
 * every message on purpose*, because forward secrecy is the entire lesson of that
 * Level. Asking for one there disables the composer the moment the Script ends
 * and never re-enables it. What a sender actually needs is a ratchet that can
 * produce the next key: a sending chain to step, or the peer's ratchet public key
 * to open a fresh chain against.
 */
export function canSend(level: Level, world: World, from: DeviceId): boolean {
  const device = deviceOf(world, from);
  if (level === "L1") return device.messageKey !== null;
  const ratchet = device.ratchet;
  if (!ratchet) return false;
  return ratchet.sendChainKey !== null || ratchet.peerPublic !== null;
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
