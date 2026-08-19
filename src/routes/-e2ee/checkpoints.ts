/**
 * The coarse layer over the Script.
 *
 * A flat list of twenty-odd Steps says where the cursor is but not where you are
 * in the story. Checkpoints group Actions into the five things that actually
 * happen — and they are derived from Action ids rather than declared, so a Script
 * that grows (the reader's own sends, Eve's attacks) lands in the right bucket
 * without anyone maintaining a second list.
 */

import type { ActionRecord, Snapshot } from "@/lib/e2ee/types";

export type CheckpointId =
  | "keygen"
  | "exchange"
  | "derive"
  | "message"
  | "break";

export type Checkpoint = {
  id: CheckpointId;
  label: string;
  /** Index in History of the first Step of this checkpoint, once one has run. */
  firstStepIndex: number | null;
  state: "done" | "current" | "todo";
};

const ORDER: CheckpointId[] = [
  "keygen",
  "exchange",
  "derive",
  "message",
  "break",
];

const LABELS: Record<CheckpointId, string> = {
  keygen: "keygen",
  exchange: "exchange",
  derive: "derive",
  message: "first message",
  break: "break it",
};

function checkpointOf(action: ActionRecord): CheckpointId {
  if (action.actor === "eve") return "break";
  if (action.id.includes("-keygen")) return "keygen";
  // L1/L2 publish raw public keys; L3 publishes and fetches a prekey bundle. Both
  // are the same beat in the story: the devices learning of each other.
  if (
    action.id.includes("-publish") ||
    action.id.includes("-recvkey") ||
    action.id.includes("-bundle") ||
    action.id.includes("-fetchbundle")
  ) {
    return "exchange";
  }
  // `-derive` covers L1's HKDF and L2's root-key init; `-agree` the static ECDH;
  // `-x3dh` L3's four exchanges. A DH ratchet belongs to the message it is for.
  if (
    action.id.includes("-agree") ||
    action.id.includes("-derive") ||
    action.id.includes("-x3dh")
  ) {
    return "derive";
  }
  return "message";
}

/**
 * Which checkpoints exist in this Script, where each begins in History, and which
 * one the cursor sits in. `break` is always listed even before Eve does anything,
 * because it is the invitation.
 */
export function checkpointsOf(
  frontier: Snapshot,
  history: Snapshot[],
  cursor: number,
): Checkpoint[] {
  const stepIndexById = new Map<string, number>();
  history.forEach((snapshot, index) => {
    if (snapshot.step) stepIndexById.set(snapshot.step.id, index);
  });

  const first = new Map<CheckpointId, number>();
  const present = new Set<CheckpointId>([
    "keygen",
    "exchange",
    "derive",
    "break",
  ]);
  let cursorCheckpoint: CheckpointId | null = null;

  for (const action of frontier.actions) {
    const id = checkpointOf(action);
    present.add(id);
    for (const stepId of action.stepIds) {
      const index = stepIndexById.get(stepId);
      if (index === undefined) continue;
      if (!first.has(id) || index < first.get(id)!) first.set(id, index);
      if (index === cursor) cursorCheckpoint = id;
    }
  }

  // Sitting on the initial Snapshot, nothing has happened yet; the first
  // checkpoint is where you are about to be.
  if (cursorCheckpoint === null) cursorCheckpoint = "keygen";
  const cursorRank = ORDER.indexOf(cursorCheckpoint);

  return ORDER.filter((id) => present.has(id)).map((id) => {
    const rank = ORDER.indexOf(id);
    return {
      id,
      label: LABELS[id],
      firstStepIndex: first.get(id) ?? null,
      state:
        rank === cursorRank ? "current" : rank < cursorRank ? "done" : "todo",
    };
  });
}
