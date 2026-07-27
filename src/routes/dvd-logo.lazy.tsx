import { createLazyFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useState } from "react";
import "@/styles/dvd-logo.css";
import { useResizeObserver } from "@/lib/use-resize-observer";
import {
  CheckIcon,
  GaugeIcon,
  PauseIcon,
  PinIcon,
  PinOffIcon,
  PlayIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShrinkIcon,
} from "lucide-react";
import { Checkbox, Slider } from "radix-ui";

export const Route = createLazyFileRoute("/dvd-logo")({
  component: () => <DVD />,
});

const DVDLogo = ({ inverted = false }: { inverted: boolean }) => (
  <div className="relative inline font-[consolas,sans-serif] font-black italic transition-[font-size] duration-100 ease-linear">
    <div
      className={clsx("scale-y-50 leading-[0.3em]", {
        "p-2 text-black": inverted,
      })}
    >
      DVD
    </div>
    <div
      className={clsx(
        "translate-y-[15%] scale-y-70 rounded-[50%] text-center text-[0.2em] leading-[1em] tracking-[0.3em] text-black",
        {
          "bg-(--color)": !inverted,
          "m-2 -mt-2 bg-black p-1 text-(--color)": inverted,
        },
      )}
    >
      VIDEO
    </div>
  </div>
);

const lts = "0123456789abcdef";
const rnd_i = (range = 16) => {
  return Math.floor(Math.random() * range);
};
const getRandomColor = () => {
  return `#${lts[rnd_i()]}${lts[rnd_i()]}${lts[rnd_i()]}`;
};

const container_id = "dvd-logo-container";
const bouncer_id = "bouncer";

const DVD = () => {
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(960);
  const [color, setColor] = useState("#ffffff");

  const [speed, setSpeed] = useState(15);
  const [size, setSize] = useState(8);
  const [outline, setOutline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [count, setCount] = useState(0);
  const [hit, setHit] = useState(0);
  const [showStatus, setShowStatus] = useState(false);
  const [inverted, setInverted] = useState(false);

  const clearCount = () => {
    setCount(0);
    setHit(0);
  };

  useResizeObserver(
    () => document.getElementById(container_id),
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target.id === container_id) {
          setWidth(entry.contentRect.width);
          setHeight(entry.contentRect.height);
        }
      });
    },
    { box: "border-box" },
  );

  useEffect(() => {
    let timer: null | number = null;
    const handleBounce = () => {
      setColor(getRandomColor);
      setCount((preCount) => preCount + 1);
      const now = performance.now();
      const cost = now - (timer || 0);
      if (cost < 50) {
        setHit((preCount) => preCount + 1);
      }
      timer = now;
    };

    // Border touch Event
    const bouncer = document.getElementById(bouncer_id);
    if (!bouncer) {
      return;
    }
    bouncer.addEventListener("animationiteration", handleBounce);

    // Clean Up
    return () => {
      bouncer.removeEventListener("animationiteration", handleBounce);
    };
  }, []);

  const ControlPanel = (
    <div
      className={clsx(
        "absolute top-4 right-4 flex flex-col overflow-hidden rounded-lg bg-neutral-100/80 p-4 font-bold text-neutral-700 transition-opacity",
        {
          "opacity-100": showPanel,
          "opacity-0 focus-within:opacity-30 hover:opacity-30": !showPanel,
        },
      )}
    >
      <div className="flex justify-between">
        <h1 className="mb-4 flex items-center gap-1 font-bold uppercase">
          <SettingsIcon size={18} />
          Setting
        </h1>
        <button
          onClick={() => {
            setShowPanel((v) => !v);
          }}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900"
        >
          {showPanel ? <PinIcon /> : <PinOffIcon />}
        </button>
      </div>
      <label className="mb-2 flex flex-col">
        <span className="flex items-center gap-1 text-sm uppercase">
          <GaugeIcon size={16} /> Speed
        </span>
        <Slider.Root
          value={[speed]}
          onValueChange={([v]) => {
            setSpeed(v);
          }}
          className="relative flex h-5 w-40 touch-none items-center select-none"
          min={1}
          step={1}
          max={50}
        >
          <Slider.Track className="relative h-0.75 grow rounded-full bg-neutral-400">
            <Slider.Range className="absolute h-full rounded-full bg-white" />
          </Slider.Track>
          <Slider.Thumb
            className="hover:bg-violet3 block size-3 rounded-[10px] bg-white shadow-[0_2px_10px] shadow-neutral-600 focus:shadow-[0_0_0_2px] focus:outline-hidden"
            aria-label="Volume"
          />
        </Slider.Root>
      </label>

      <label className="mb-2 flex flex-col">
        <span className="flex items-center gap-1 text-sm uppercase">
          <ShrinkIcon size={16} /> Size
        </span>
        <Slider.Root
          value={[size]}
          onValueChange={([z]) => {
            setSize(z);
          }}
          className="relative flex h-5 w-40 touch-none items-center select-none"
          min={3}
          step={0.1}
          max={30}
        >
          <Slider.Track className="relative h-0.75 grow rounded-full bg-neutral-400">
            <Slider.Range className="absolute h-full rounded-full bg-white" />
          </Slider.Track>
          <Slider.Thumb
            className="hover:bg-violet3 block size-3 rounded-[10px] bg-white shadow-[0_2px_10px] shadow-neutral-600 focus:shadow-[0_0_0_2px] focus:outline-hidden"
            aria-label="Volume"
          />
        </Slider.Root>
      </label>

      <label className="mb-2 flex items-center justify-between gap-2 text-sm">
        Show Line
        <Checkbox.Root
          className="inline-flex size-4 items-center justify-center rounded-sm bg-white"
          checked={outline}
          onCheckedChange={(e) => {
            if (e === "indeterminate") {
              setOutline(false);
              return;
            }
            setOutline(e);
          }}
        >
          <Checkbox.Indicator>
            <CheckIcon size={12} />
          </Checkbox.Indicator>
        </Checkbox.Root>
      </label>

      <label className="mb-2 flex items-center justify-between gap-2 text-sm">
        Show Status
        <Checkbox.Root
          className="inline-flex size-4 items-center justify-center rounded-sm bg-white"
          checked={showStatus}
          onCheckedChange={(e) => {
            if (e === "indeterminate") {
              setShowStatus(false);
              return;
            }
            setShowStatus(e);
          }}
        >
          <Checkbox.Indicator>
            <CheckIcon size={12} />
          </Checkbox.Indicator>
        </Checkbox.Root>
      </label>

      <label className="mb-2 flex items-center justify-between gap-2 text-sm">
        Inverted Color
        <Checkbox.Root
          className="inline-flex size-4 items-center justify-center rounded-sm bg-white"
          checked={inverted}
          onCheckedChange={(e) => {
            if (e === "indeterminate") {
              setInverted(false);
              return;
            }
            setInverted(e);
          }}
        >
          <Checkbox.Indicator>
            <CheckIcon size={12} />
          </Checkbox.Indicator>
        </Checkbox.Root>
      </label>
    </div>
  );

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      id={container_id}
    >
      {/* Bouncer Element */}
      <div
        className={clsx("ud leading-0", {
          "outline-2 outline-blue-500 outline-solid": outline,
        })}
        style={{
          animationDuration: `${height / speed ** 2}s`,
          animationPlayState: paused ? "paused" : "running",
          ["--color" as string]: color,
        }}
        id={bouncer_id}
      >
        <div
          className={clsx("lr leading-0", {
            "outline-2 outline-red-500 outline-solid": outline,
            "bg-current": inverted,
          })}
          style={{
            animationDuration: `${width / speed ** 2}s`,
            fontSize: `${size}rem`,
            color,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          <DVDLogo inverted={inverted} />
        </div>
      </div>

      {/* Panel */}
      {ControlPanel}

      {showStatus && (
        <div className="absolute bottom-4 left-4 rounded-lg border border-neutral-700 p-4 text-neutral-400">
          <dl className="mb-4">
            <dt>Bounce</dt>
            <dd>{count}</dd>
            <dt>Hit Corner</dt>
            <dd>{hit}</dd>
          </dl>
          <button
            className="rounded p-2 hover:bg-neutral-700"
            onClick={() => {
              setPaused((p) => !p);
            }}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button
            className="rounded p-2 hover:bg-neutral-700"
            onClick={clearCount}
          >
            <RotateCcwIcon />
          </button>
        </div>
      )}
    </div>
  );
};
