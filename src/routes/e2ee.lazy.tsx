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

// Attached while this route is mounted and detached when it is not, so the
// `.mn-dark` ramp and the chassis classes never outlive the page. Same hook the
// CV route uses for its print stylesheet.
import e2eeStyleHref from "./-e2ee/e2ee.css?url";
import { useStyleData } from "@/lib/useStyleData";
import { attackActions, type AttackKind } from "@/lib/e2ee/attacks";
import {
  canSend,
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
import { deviceOf } from "@/lib/e2ee/world";
import { checkpointsOf } from "./-e2ee/checkpoints";
import { useE2eeSettings, useRootFontScale } from "./-e2ee/settings";
import { ArtModeContext, useArtMode } from "./-e2ee/art";
import { FloatingNote } from "./-e2ee/callout";
import { DevicePanel } from "./-e2ee/device-panel";
import { FlightDriver, FlightLayer } from "./-e2ee/flight";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createLazyFileRoute("/e2ee")({
  component: E2eePage,
});

const PLAY_INTERVAL_MS = 900;

function sameBytes(a: Bytes | null, b: Bytes | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((byte, index) => byte === b[index]);
}

function E2eePage() {
  useStyleData({ id: "e2ee-styles", style: null, link: e2eeStyleHref });
  const {
    settings,
    update: updateSettings,
    reset: resetSettings,
  } = useE2eeSettings();
  useRootFontScale(settings.scale);
  useArtMode(settings.art);
  const [level, setLevel] = useState<Level>("L1");
  const [history, setHistory] = useState<Snapshot[]>(() => [
    initialSnapshot("L1"),
  ]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  /**
   * Which History the running Step belongs to. Bumped whenever the History is
   * replaced wholesale, so a Step that resolves afterwards knows to discard.
   */
  const generation = useRef(0);
  /** `busy` again, readable from inside a callback that captured an older render. */
  const busyRef = useRef(false);
  /** Actions asked for while a Step was running, waiting for a Snapshot to sit on. */
  const queued = useRef<{ actions: Action[]; position: "next" | "end" }[]>([]);

  const frontier = history[history.length - 1];
  const view = history[cursor];
  const atFrontier = cursor === history.length - 1;
  const canStepForward = !atFrontier || frontier.queue.length > 0;

  /** Queue Eve's Actions ahead of whatever delivery is still pending. */
  const queueOnFrontier = useCallback(
    (actions: Action[], position: "next" | "end") => {
      // A Step in flight was handed the Frontier as it stood when it started, and
      // the Snapshot it returns is built from that. Adding to the Frontier entry
      // now would be overwritten the moment it resolves — which is how attacks
      // clicked during playback used to vanish without a trace. So they wait, and
      // `drainQueued` puts them on the Snapshot that actually lands.
      if (busyRef.current) {
        queued.current.push({ actions, position });
        return;
      }
      setHistory((entries) => [
        ...entries.slice(0, -1),
        queueActions(entries[entries.length - 1], actions, position),
      ]);
    },
    [],
  );

  const drainQueued = useCallback(() => {
    const pending = queued.current;
    if (pending.length === 0) return;
    queued.current = [];
    setHistory((entries) => [
      ...entries.slice(0, -1),
      pending.reduce(
        (snapshot, item) => queueActions(snapshot, item.actions, item.position),
        entries[entries.length - 1],
      ),
    ]);
  }, []);

  const next = useCallback(async () => {
    if (cursor < history.length - 1) {
      setCursor(cursor + 1);
      return;
    }
    if (frontier.queue.length === 0) return;
    // A Step can take seconds — L5's backup crack is 24 × 100 000 PBKDF2 rounds —
    // and the mission picker stays live throughout. Whichever History this Step
    // belongs to may therefore be gone by the time it resolves, so the run is
    // stamped and a stale result is dropped rather than appended to a History it
    // was never computed against.
    const stamp = generation.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const snapshot = await runNextStep(frontier);
      if (generation.current !== stamp) return;
      setHistory((entries) => [...entries, snapshot]);
      // From the length, not `history.length`: that was captured before the await
      // and is one behind by now. We are at the Frontier here, so the appended
      // Snapshot is the next index either way.
      setCursor((current) => current + 1);
      drainQueued();
    } finally {
      if (generation.current === stamp) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [cursor, frontier, history.length, drainQueued]);

  const restart = useCallback((nextLevel: Level) => {
    // Anything still running belongs to the History being thrown away.
    generation.current += 1;
    busyRef.current = false;
    queued.current = [];
    setBusy(false);
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
      // These three do not act on a packet in flight at all — they act on the
      // store, or on the traffic as a whole. They still need *a* packet to satisfy
      // the caller, and `attackActions` ignores it for them.
      if (
        attack === "swapBlob" ||
        attack === "crackBackup" ||
        attack === "traceTraffic"
      ) {
        return packets[packets.length - 1] ?? null;
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
      const store = frontier.world.store;
      if (attack === "swapBlob" && !store.some((o) => o.holder === "cdn")) {
        return "Nothing is on the CDN yet. Let the attachment finish uploading.";
      }
      if (
        attack === "crackBackup" &&
        !store.some((o) => o.holder === "backup")
      ) {
        return "No archive at the provider yet. Let the backup finish.";
      }
      if (attack === "traceTraffic" && frontier.world.packets.length === 0) {
        return "She needs traffic to read the shape of. Let something move first.";
      }
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
    [atFrontier, frontier.world, packetFor],
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
      // Two devices, so the recipient is simply the other one. Multi-device
      // replaces this with a chosen conversation — which is exactly why
      // `sendActionsFor` takes an explicit `to` rather than working it out.
      const to = frontier.world.deviceOrder.find((id) => id !== from);
      if (!to) return;
      queueOnFrontier(
        sendActionsFor(level, frontier.world, from, to, text),
        "end",
      );
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

  // The stage is two columns around the Wire, so it reads the first two ids in
  // `deviceOrder` rather than naming them. A third device needs a layout, not a
  // lookup, which is why this asserts rather than quietly rendering two of three.
  const [leftId, rightId] = view.world.deviceOrder;
  const left = deviceOf(view.world, leftId);
  const right = deviceOf(view.world, rightId);

  const acceptedReplay = [...left.inbox, ...right.inbox].some(
    (entry) => entry.wasReplay,
  );
  const derivedTogether =
    (changes.fields.has(`${leftId}.sharedSecret`) ||
      changes.fields.has(`${rightId}.sharedSecret`)) &&
    sameBytes(left.sharedSecret, right.sharedSecret);
  const rootsAgree =
    (changes.fields.has(`${leftId}.rootKey`) ||
      changes.fields.has(`${rightId}.rootKey`)) &&
    sameBytes(left.ratchet?.rootKey ?? null, right.ratchet?.rootKey ?? null);

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
    <ArtModeContext.Provider value={settings.art}>
      <Tooltip.Provider delayDuration={200}>
        {/*
        `mn-dark` pins this route to Modernist's dark ramp whatever the site
        theme is (see the token block in index.css). The chrome this page is
        built out of — recessed lanes, corner ticks, the accent glow on a slot
        that just filled — is HUD grammar, and it only reads on a dark ground.
      */}
        <main className="mn-dark relative flex min-h-[100dvh] flex-col bg-mn-bg font-mn text-mn-ink lg:h-[100dvh] lg:overflow-hidden">
          <FlightLayer>
            <FlightDriver cursor={cursor} snapshot={view} changes={changes} />
            <Hud
              level={level}
              onSelect={restart}
              executed={history.length - 1}
              total={history.length - 1 + frontier.queue.length}
              settings={settings}
              onSettingsChange={updateSettings}
              onSettingsReset={resetSettings}
            />

            <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_1.25fr_1fr]">
              <DevicePanel
                device={left}
                level={level}
                align="left"
                atFrontier={atFrontier}
                canSend={atFrontier && canSend(level, view.world, leftId)}
                onSend={onSend}
                changes={changes}
                failure={failureOn(leftId)}
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
                device={right}
                level={level}
                align="right"
                atFrontier={atFrontier}
                canSend={atFrontier && canSend(level, view.world, rightId)}
                onSend={onSend}
                changes={changes}
                failure={failureOn(rightId)}
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
                body="This is the attack that landed at Mission 01. The ciphertext is still perfectly valid — but the message key for that position was deleted the moment it was used, and HMAC-SHA-256 cannot be run backwards to produce it again. The refusal is an absent key, not a policy."
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
                onDismiss={() =>
                  setDismissed((all) => ({ ...all, heldFs: true }))
                }
              />
            ) : heldSignature && !dismissed.heldSig ? (
              <FloatingNote
                tone="ink"
                kicker="the signature held"
                title="crypto.subtle.verify returned false"
                icon={<FileSignatureIcon size={20} />}
                body="Eve swapped a key in the bundle and could not re-sign it, so the prekey no longer matched the identity that published it. Alice aborted before deriving anything — there is no session for Eve to sit in the middle of. This is the weakness Mission 01 and Mission 02 both carried."
                onDismiss={() =>
                  setDismissed((all) => ({ ...all, heldSig: true }))
                }
              />
            ) : acceptedReplay && !dismissed.replay ? (
              <FloatingNote
                tone="accent"
                kicker="eve got away with it"
                title="A replay was accepted"
                icon={<RepeatIcon size={20} />}
                body="The ciphertext was valid and its tag verified, because Alice really did send it. Mission 01 simply keeps no record of which counters it has already opened — freshness is the protocol's job, not the cipher's. Mission 02's per-message ratchet is what makes the second delivery fail."
                onDismiss={() =>
                  setDismissed((all) => ({ ...all, replay: true }))
                }
              />
            ) : rootsAgree && !dismissed.roots ? (
              <FloatingNote
                tone="ink"
                kicker="both ends, no round trip"
                title="Same root key, nothing secret sent"
                icon={<AnchorIcon size={20} />}
                body="Both devices now hold identical root keys. Every message key from here comes out of that, one per message, deleted after use. Eve has every byte that crossed the wire and none of them contain this."
                onDismiss={() =>
                  setDismissed((all) => ({ ...all, roots: true }))
                }
              />
            ) : derivedTogether && !dismissed.derived ? (
              <FloatingNote
                tone="ink"
                kicker="this is the trick"
                title="Same secret, zero bytes sent"
                icon={<TrophyIcon size={20} />}
                body="Both devices now hold identical bytes. Compare the two shared-secret slots. Eve has every packet that crossed the wire and none of them contain this."
                onDismiss={() =>
                  setDismissed((all) => ({ ...all, derived: true }))
                }
              />
            ) : null}
          </FlightLayer>
        </main>
      </Tooltip.Provider>
    </ArtModeContext.Provider>
  );
}
