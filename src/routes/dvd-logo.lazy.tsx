import { createLazyFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useState } from "react";
import "@/styles/dvd-logo.css";
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
import {
  Slider,
  SliderRange,
  SliderThumb,
  SliderTrack,
} from "@radix-ui/react-slider";
import { Checkbox, CheckboxIndicator } from "@radix-ui/react-checkbox";

export const Route = createLazyFileRoute("/dvd-logo")({
  component: () => <DVD />,
});

const DVDLogo = () => (
  <div className="relative inline font-[consolas,sans-serif] font-black italic transition-[font-size] duration-100 ease-linear">
    <div className="scale-y-50 leading-[0.3em]">DVD</div>
    <div className="translate-y-[15%] scale-y-[70%] rounded-[50%] bg-[--color] text-center text-[0.2em] leading-[1em] tracking-[0.3em] text-black">
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

  const clearCount = () => {
    setCount(0);
    setHit(0);
  };

  useEffect(() => {
    // Resize Event Obs
    const container = document.getElementById(container_id);

    if (!container) {
      return;
    }

    const observer = new ResizeObserver((mutList) => {
      mutList.forEach((mut) => {
        if (mut.target.id === container_id) {
          setWidth(mut.contentRect.width);
          setHeight(mut.contentRect.height);
        }
      });
    });
    observer.observe(container, {
      box: "border-box",
    });

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
      return () => {
        observer.disconnect();
      };
    }
    bouncer.addEventListener("animationiteration", handleBounce);

    // Clean Up
    return () => {
      bouncer.removeEventListener("animationiteration", handleBounce);
      observer.disconnect();
    };
  }, []);

  const ControlPanel = (
    <div
      className={clsx(
        "absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg bg-neutral-100/80 p-4 font-bold text-neutral-700 transition-opacity",
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
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900"
        >
          {showPanel ? <PinIcon /> : <PinOffIcon />}
        </button>
      </div>
      <label className="mb-2 flex flex-col">
        <span className="flex items-center gap-1 text-sm uppercase">
          <GaugeIcon size={16} /> Speed
        </span>
        <Slider
          value={[speed]}
          onValueChange={([v]) => {
            setSpeed(v);
          }}
          className="relative flex h-5 w-[160px] touch-none select-none items-center"
          min={1}
          step={1}
          max={50}
        >
          <SliderTrack className="relative h-[3px] grow rounded-full bg-neutral-400">
            <SliderRange className="absolute h-full rounded-full bg-white" />
          </SliderTrack>
          <SliderThumb
            className="hover:bg-violet3 block size-3 rounded-[10px] bg-white shadow-[0_2px_10px] shadow-neutral-600 focus:shadow-[0_0_0_2px] focus:outline-none"
            aria-label="Volume"
          />
        </Slider>
      </label>

      <label className="mb-2 flex flex-col">
        <span className="flex items-center gap-1 text-sm uppercase">
          <ShrinkIcon size={16} /> Size
        </span>
        <Slider
          value={[size]}
          onValueChange={([z]) => {
            setSize(z);
          }}
          className="relative flex h-5 w-[160px] touch-none select-none items-center"
          min={3}
          step={0.1}
          max={30}
        >
          <SliderTrack className="relative h-[3px] grow rounded-full bg-neutral-400">
            <SliderRange className="absolute h-full rounded-full bg-white" />
          </SliderTrack>
          <SliderThumb
            className="hover:bg-violet3 block size-3 rounded-[10px] bg-white shadow-[0_2px_10px] shadow-neutral-600 focus:shadow-[0_0_0_2px] focus:outline-none"
            aria-label="Volume"
          />
        </Slider>
      </label>

      <label className="mb-2 flex items-center justify-between gap-2 text-sm">
        Show Line
        <Checkbox
          className="inline-flex size-4 items-center justify-center rounded bg-white"
          checked={outline}
          onCheckedChange={(e) => {
            if (e === "indeterminate") {
              setOutline(false);
              return;
            }
            setOutline(e);
          }}
        >
          <CheckboxIndicator>
            <CheckIcon size={12} />
          </CheckboxIndicator>
        </Checkbox>
      </label>

      <label className="mb-2 flex items-center justify-between gap-2 text-sm">
        Show Status
        <Checkbox
          className="inline-flex size-4 items-center justify-center rounded bg-white"
          checked={showStatus}
          onCheckedChange={(e) => {
            if (e === "indeterminate") {
              setShowStatus(false);
              return;
            }
            setShowStatus(e);
          }}
        >
          <CheckboxIndicator>
            <CheckIcon size={12} />
          </CheckboxIndicator>
        </Checkbox>
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
        className={clsx("ud leading-[0]", {
          "outline outline-2 outline-blue-500": outline,
        })}
        style={{
          animationDuration: `${height / speed ** 2}s`,
          animationPlayState: paused ? "paused" : "running",
          ["--color" as string]: color,
        }}
        id={bouncer_id}
      >
        <div
          className={clsx("lr leading-[0]", {
            "outline outline-2 outline-red-500": outline,
          })}
          style={{
            animationDuration: `${width / speed ** 2}s`,
            fontSize: `${size}rem`,
            color,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          <DVDLogo />
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
