import { createLazyFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useState } from "react";
import "@/styles/dvd-logo.css";

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
  const [outline, setOutline] = useState(true);
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

      {/* <div className={`control-panel${!showPanel ? "hidden" : ""}`}>
        <div className="control-header">
          <span>Setting</span>
          <IconButton
            aria-label="show control"
            onClick={(e) => setShowPanel(!showPanel)}
            size="large"
          >
            {showPanel ? (
              <Visibility fontSize="small" />
            ) : (
              <VisibilityOff fontSize="small" />
            )}
          </IconButton>
        </div>
        <form className="control-form" noValidate autoComplete="off">
          <Typography gutterBottom>Logo Size</Typography>
          <Slider
            value={size}
            onChange={(e, v) => setSize(Number(v))}
            aria-labelledby="size-slider"
            min={3}
            step={0.1}
            max={30}
          />
          <Typography gutterBottom>Speed</Typography>
          <Slider
            value={speed}
            onChange={(e, v) => setSpeed(Number(v))}
            aria-labelledby="speed-slider"
            min={1}
            step={1}
            max={50}
          />
          <FormControlLabel
            control={
              <Switch
                checked={outline}
                onChange={(e) => {
                  setOutline(!outline);
                }}
                name="outline"
                color="primary"
              />
            }
            label="Outline"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!paused}
                onChange={(e) => {
                  setPaused(!paused);
                }}
                name="Play"
                color="primary"
              />
            }
            label="Play"
          />
          <FormControlLabel
            control={
              <Switch
                checked={showStatus}
                onChange={(e) => {
                  setShowStatus(!showStatus);
                }}
                name="Status"
                color="primary"
              />
            }
            label="Status"
          />
          <IconButton
            aria-label="Clear Status"
            onClick={clearCount}
            size="large"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </form>
      </div>

      <Slide direction="up" in={showStatus} mountOnEnter unmountOnExit appear>
        <div className="counter">
          <dl>
            <dt>Bounce</dt>
            <dd>{count}</dd>
            <dt>Hit Corner</dt>
            <dd>{hit}</dd>
          </dl>
        </div>
      </Slide> */}
    </div>
  );
};
