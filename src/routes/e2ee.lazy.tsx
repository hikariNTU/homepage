/**
 * Page shell for the E2EE visualiser: owns History, the cursor, and the Level.
 *
 * Forward at the Frontier runs real cryptography; every other movement is a read
 * of History. All the actual crypto lives in `src/lib/e2ee/`.
 *
 * The layout is an instrument, not an article: a HUD, three columns of state, and
 * a transport bar that expands into the per-Step rail. Prose is contextual —
 * attached to the step, slot or packet it explains.
 */

import { attackActions, type AttackKind } from "@/lib/e2ee/attacks";
import {
  initialSnapshot,
  levelInfo,
  queueActions,
  runNextStep,
  sendActionsFor,
} from "@/lib/e2ee/session";
import type {
  Action,
  Bytes,
  DeviceId,
  Level,
  Packet,
  Snapshot,
} from "@/lib/e2ee/types";
import { diffWorlds } from "@/lib/e2ee/diff";
import { checkpointsOf } from "./-e2ee/checkpoints";
import { FloatingNote } from "./-e2ee/callout";
import { DevicePanel } from "./-e2ee/device-panel";
import { Hud } from "./-e2ee/hud";
import { QuestBar } from "./-e2ee/quest-bar";
import { Wire } from "./-e2ee/wire";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Tooltip } from "radix-ui";
import {
  AnchorIcon,
  FileSignatureIcon,
  FlameIcon,
  RepeatIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createLazyFileRoute("/e2ee")({
  component: E2eePage,
});

const PLAY_INTERVAL_MS = 900;

function sameBytes(a: Bytes | null, b: Bytes | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((byte, index) => byte === b[index]);
}

function E2eePage() {
  const [level, setLevel] = useState<Level>("L1");
  const [history, setHistory] = useState<Snapshot[]>(() => [
    initialSnapshot("L1"),
  ]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const frontier = history[history.length - 1];
  const view = history[cursor];
  const atFrontier = cursor === history.length - 1;
  const canStepForward = !atFrontier || frontier.queue.length > 0;

  const next = useCallback(async () => {
    if (cursor < history.length - 1) {
      setCursor(cursor + 1);
      return;
    }
    if (frontier.queue.length === 0) return;
    setBusy(true);
    try {
      const snapshot = await runNextStep(frontier);
      setHistory((entries) => [...entries, snapshot]);
      setCursor(history.length);
    } finally {
      setBusy(false);
    }
  }, [cursor, frontier, history.length]);

  const restart = useCallback((nextLevel: Level) => {
    setPlaying(false);
    setLevel(nextLevel);
    setHistory([initialSnapshot(nextLevel)]);
    setCursor(0);
    setDismissed({});
  }, []);

  // Playback: one Step per tick, stopping at the end of the Script or on the
  // first failure — a thrown GCM tag check is something to look at, not skip.
  useEffect(() => {
    if (!playing) return;
    if (view.step && !view.step.outcome.ok) {
      setPlaying(false);
      return;
    }
    if (!canStepForward) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => void next(), PLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, canStepForward, next, view]);

  /** Queue Eve's Actions ahead of whatever delivery is still pending. */
  const queueOnFrontier = useCallback(
    (actions: Action[], position: "next" | "end") => {
      setHistory((entries) => [
        ...entries.slice(0, -1),
        queueActions(entries[entries.length - 1], actions, position),
      ]);
    },
    [],
  );

  /** Which Packet a given move acts on, or null when it has nothing to act on. */
  const packetFor = useCallback(
    (attack: AttackKind): Packet | null => {
      const packets = frontier.world.packets;
      if (attack === "replay") {
        return (
          [...packets]
            .reverse()
            .find(
              (packet) =>
                packet.kind === "sealed-message" &&
                packet.status === "delivered" &&
                !packet.replayOf,
            ) ?? null
        );
      }
      // Stealing a device is only interesting against something already captured,
      // and the oldest capture makes the point best.
      if (attack === "compromise") {
        return (
          packets.find(
            (packet) =>
              packet.kind === "sealed-message" && packet.status === "delivered",
          ) ?? null
        );
      }
      if (attack === "substituteKey") {
        return (
          packets.find(
            (packet) =>
              packet.kind === "prekey-bundle" && packet.status === "in-flight",
          ) ?? null
        );
      }
      return (
        [...packets]
          .reverse()
          .find((packet) => packet.status === "in-flight") ?? null
      );
    },
    [frontier],
  );

  const attackHint = useCallback(
    (attack: AttackKind): string | null => {
      if (!atFrontier) return "Return to the latest step first.";
      if (!packetFor(attack)) {
        switch (attack) {
          case "replay":
            return "Let a sealed message finish arriving first — Eve replays what she has already seen delivered.";
          case "compromise":
            return "Eve needs a captured message to try the stolen keys against. Let one be delivered first.";
          case "substituteKey":
            return "The prekey bundle has to be in flight. Run the publish step, and act before it is fetched.";
          default:
            return "Nothing is in flight. Send a message, or advance to a step that puts bytes on the wire.";
        }
      }
      return null;
    },
    [atFrontier, packetFor],
  );

  const onAttack = useCallback(
    (kind: AttackKind) => {
      if (!atFrontier) return;
      const packet = packetFor(kind);
      if (!packet) return;
      queueOnFrontier(
        attackActions(level, kind, packet, frontier.world),
        "next",
      );
    },
    [atFrontier, frontier.world, level, packetFor, queueOnFrontier],
  );

  const onSend = useCallback(
    (from: DeviceId, text: string) => {
      if (!atFrontier) return;
      queueOnFrontier(sendActionsFor(level, frontier.world, from, text), "end");
    },
    [atFrontier, frontier.world, level, queueOnFrontier],
  );

  // What the Step you are looking at actually changed, by comparing it with the
  // Snapshot before it. Reference equality suffices — nothing is mutated.
  const changes = useMemo(
    () => diffWorlds(cursor > 0 ? history[cursor - 1].world : null, view.world),
    [cursor, history, view],
  );

  const checkpoints = useMemo(
    () => checkpointsOf(frontier, history, cursor),
    [frontier, history, cursor],
  );

  const { alice, bob } = view.world;

  const acceptedReplay = [...alice.inbox, ...bob.inbox].some(
    (entry) => entry.wasReplay,
  );
  const derivedTogether =
    (changes.fields.has("alice.sharedSecret") ||
      changes.fields.has("bob.sharedSecret")) &&
    sameBytes(alice.sharedSecret, bob.sharedSecret);
  const rootsAgree =
    (changes.fields.has("alice.rootKey") ||
      changes.fields.has("bob.rootKey")) &&
    sameBytes(alice.ratchet?.rootKey ?? null, bob.ratchet?.rootKey ?? null);

  // A defence holding is worth saying once, at the moment it holds — and it is
  // read off the failed Step, so it can only appear when it genuinely happened.
  const failedStep = view.step && !view.step.outcome.ok ? view.step : null;
  const failure = failedStep?.outcome.ok === false ? failedStep.outcome : null;
  const heldReplay = failure?.errorName === "ReplayRejected";
  const heldForwardSecrecy = failure?.errorName === "NoKeyForThisMessage";
  const heldSignature = failure?.errorName === "SignatureRejected";

  const failureOn = (device: DeviceId) =>
    view.step && !view.step.outcome.ok && view.step.actor === device
      ? view.step
      : null;

  return (
    <Tooltip.Provider delayDuration={200}>
      <main className="relative flex min-h-[100dvh] flex-col bg-mn-bg font-mn text-mn-ink lg:h-[100dvh] lg:overflow-hidden">
        <Hud
          level={level}
          onSelect={restart}
          executed={history.length - 1}
          total={history.length - 1 + frontier.queue.length}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_1.25fr_1fr]">
          <DevicePanel
            device={alice}
            level={level}
            align="left"
            atFrontier={atFrontier}
            canSend={atFrontier && Boolean(alice.messageKey)}
            onSend={onSend}
            changes={changes}
            failure={failureOn("alice")}
          />
          <Wire
            snapshot={view}
            info={levelInfo(level)}
            atFrontier={atFrontier}
            onAttack={onAttack}
            attackHint={attackHint}
            changes={changes}
          />
          <DevicePanel
            device={bob}
            level={level}
            align="right"
            atFrontier={atFrontier}
            canSend={atFrontier && Boolean(bob.messageKey)}
            onSend={onSend}
            changes={changes}
            failure={failureOn("bob")}
          />
        </div>

        <QuestBar
          history={history}
          frontier={frontier}
          cursor={cursor}
          checkpoints={checkpoints}
          nextStep={frontier.queue[0] ?? null}
          atFrontier={atFrontier}
          busy={busy}
          playing={playing}
          canStepForward={canStepForward}
          onSeek={setCursor}
          onPrev={() => setCursor((index) => Math.max(0, index - 1))}
          onNext={() => void next()}
          onTogglePlay={() => setPlaying((on) => !on)}
          onReset={() => restart(level)}
        />

        {heldReplay && !dismissed.heldReplay ? (
          <FloatingNote
            tone="ink"
            kicker="the ratchet held"
            title="The replay had nothing left to open it"
            icon={<ShieldCheckIcon size={20} />}
            body="This is the attack that landed at L1. The ciphertext is still perfectly valid — but the message key for that position was deleted the moment it was used, and HMAC-SHA-256 cannot be run backwards to produce it again. The refusal is an absent key, not a policy."
            onDismiss={() =>
              setDismissed((all) => ({ ...all, heldReplay: true }))
            }
          />
        ) : heldForwardSecrecy && !dismissed.heldFs ? (
          <FloatingNote
            tone="ink"
            kicker="forward secrecy"
            title="Eve has the device and still cannot read it"
            icon={<FlameIcon size={20} />}
            body="She holds the current chain key, the root key, and the identity private key. None of it produces the key that sealed the message she captured, because each chain step throws the previous key away. What she can read is what comes next — until the next change of direction takes that away too."
            onDismiss={() => setDismissed((all) => ({ ...all, heldFs: true }))}
          />
        ) : heldSignature && !dismissed.heldSig ? (
          <FloatingNote
            tone="ink"
            kicker="the signature held"
            title="crypto.subtle.verify returned false"
            icon={<FileSignatureIcon size={20} />}
            body="Eve swapped a key in the bundle and could not re-sign it, so the prekey no longer matched the identity that published it. Alice aborted before deriving anything — there is no session for Eve to sit in the middle of. This is the weakness L1 and L2 both carried."
            onDismiss={() => setDismissed((all) => ({ ...all, heldSig: true }))}
          />
        ) : acceptedReplay && !dismissed.replay ? (
          <FloatingNote
            tone="accent"
            kicker="eve got away with it"
            title="A replay was accepted"
            icon={<RepeatIcon size={20} />}
            body="The ciphertext was valid and its tag verified, because Alice really did send it. L1 simply keeps no record of which counters it has already opened — freshness is the protocol's job, not the cipher's. L2's per-message ratchet is what makes the second delivery fail."
            onDismiss={() => setDismissed((all) => ({ ...all, replay: true }))}
          />
        ) : rootsAgree && !dismissed.roots ? (
          <FloatingNote
            tone="ink"
            kicker="both ends, no round trip"
            title="Same root key, nothing secret sent"
            icon={<AnchorIcon size={20} />}
            body="Both devices now hold identical root keys. Every message key from here comes out of that, one per message, deleted after use. Eve has every byte that crossed the wire and none of them contain this."
            onDismiss={() => setDismissed((all) => ({ ...all, roots: true }))}
          />
        ) : derivedTogether && !dismissed.derived ? (
          <FloatingNote
            tone="ink"
            kicker="this is the trick"
            title="Same secret, zero bytes sent"
            icon={<TrophyIcon size={20} />}
            body="Both devices now hold identical bytes. Compare the two shared-secret slots. Eve has every packet that crossed the wire and none of them contain this."
            onDismiss={() => setDismissed((all) => ({ ...all, derived: true }))}
          />
        ) : null}
      </main>
    </Tooltip.Provider>
  );
}
