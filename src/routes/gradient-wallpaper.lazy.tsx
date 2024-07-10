import { createLazyFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { ArrowRightIcon, ChevronLeftIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createLazyFileRoute("/gradient-wallpaper")({
  component: () => <Wallpaper />,
});

const Wallpaper = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stop1, setStop1] = useState("#336375");
  const [stop2, setStop2] = useState("#333333");
  const [where, setWhere] = useState([0, 0]);
  const [globalOpacity, setGlobalOpacity] = useState(100);
  const [globalOpacityID, setGlobalOpacityID] = useState<NodeJS.Timeout>();
  const [globalOpacityArray, setGlobalOpacityArray] = useState<string[]>([]);
  const [composite, setComposite] =
    useState<GlobalCompositeOperation>("source-over");

  const fillGrad = (
    wall: HTMLCanvasElement,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stop1: string,
    stop2: string | number,
    opacity = 100,
    composite: GlobalCompositeOperation = "source-over",
  ) => {
    if (x0 === x1 && y0 === y1) {
      return;
    }
    const ctx = wall.getContext("2d");

    if (!ctx) {
      return;
    }

    if (ctx.globalCompositeOperation !== composite) {
      ctx.globalCompositeOperation = composite;
    }

    const w = wall.clientWidth;
    const h = wall.clientHeight;
    if (wall.width !== w || wall.height !== h) {
      // TODO: fix pixels content disappearing problem
      wall.width = w;
      wall.height = h;
    }

    const grd = ctx.createLinearGradient(x0, y0, x1, y1);
    let opacity_hex = Math.floor(opacity * 2.55).toString(16);
    if (opacity_hex.length === 1) {
      opacity_hex = "0" + opacity_hex;
    }
    grd.addColorStop(0, `${stop1}${opacity_hex}`);
    grd.addColorStop(1.0, `${stop2}${opacity_hex}`);
    // grd.addColorStop(0, `rgba(0,0,0,1.0)`)
    // grd.addColorStop(1.0, `rgba(0,255,0,0.1)`)
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, wall.width, wall.height);
  };

  useEffect(() => {
    if (!canvas.current) {
      return;
    }
    const w = canvas.current.clientWidth;
    const h = canvas.current.clientHeight;
    canvas.current.width = w;
    canvas.current.height = h;
    fillGrad(canvas.current, 0, 0, w, h, "#336375", "#333333");
  }, []);

  const handleKey: React.KeyboardEventHandler<HTMLCanvasElement> = (e) => {
    if ((e.key || "") in "0123456789".split("")) {
      const newArray = [...globalOpacityArray, e.key];
      setGlobalOpacityArray([...globalOpacityArray, e.key]);
      if (newArray.length < 2) {
        newArray.push("0");
      }
      setGlobalOpacity(
        Number(newArray.slice(Math.max(newArray.length - 2, 0)).join("")) ||
          100,
      );
      if (globalOpacityID) {
        clearTimeout(globalOpacityID);
        setGlobalOpacityID(undefined);
      }
      const timeID = setTimeout(() => {
        setGlobalOpacityArray([]);
      }, 1000);
      setGlobalOpacityID(timeID);
    }
  };

  const DrawHandle = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stop1: string,
    stop2: string,
    clear = false,
  ) => {
    const canvas = document.getElementById(
      "canvas-handle",
    ) as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h || clear) {
      // TODO: fix pixels content disappearing problem
      canvas.width = w;
      canvas.height = h;
      if (clear) {
        return;
      }
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.globalCompositeOperation = "copy";
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    ctx.shadowColor = "rgba(0, 0, 0, .5)";
    ctx.shadowBlur = 8;

    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // ctx.lineWidth = 3
    // ctx.strokeStyle = '#666'
    // ctx.beginPath();
    // ctx.moveTo(x0, y0);
    // ctx.lineTo(x1, y1);
    // ctx.stroke();

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(x0, y0, 5, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = stop1;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x1, y1, 5, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = stop2;
    ctx.fill();
  };

  return (
    <div className="relative max-h-screen max-w-[100vw]">
      <Drawer
        {...{
          stop1,
          stop2,
          setStop1,
          setStop2,
          setGlobalOpacity,
          globalOpacity,
          composite,
          setComposite,
        }}
      />
      <canvas id="wallpaper" ref={canvas} className="h-screen w-full" />
      <canvas
        id="canvas-handle"
        tabIndex={0}
        className="absolute left-0 top-0 h-screen w-screen"
        onMouseDown={(e) => {
          setWhere([e.clientX, e.clientY]);
        }}
        onMouseMove={(e) => {
          if (e.buttons === 1) {
            if (where.length === 2) {
              DrawHandle(
                where[0],
                where[1],
                e.clientX,
                e.clientY,
                stop1,
                stop2,
              );
            }
          }
        }}
        onMouseUp={(e) => {
          if (!canvas.current) {
            return;
          }
          if (where.length === 2) {
            fillGrad(
              canvas.current,
              where[0],
              where[1],
              e.clientX,
              e.clientY,
              stop1,
              stop2,
              globalOpacity,
              composite,
            );
          }
          DrawHandle(0, 0, 0, 0, stop1, stop2, true);
          setWhere([]);
        }}
        onKeyUp={handleKey}
      />
    </div>
  );
};

function Drawer(props: {
  stop1: string;
  stop2: string;
  setStop1: React.Dispatch<React.SetStateAction<string>>;
  setStop2: React.Dispatch<React.SetStateAction<string>>;
  globalOpacity: number;
  setGlobalOpacity: React.Dispatch<React.SetStateAction<number>>;
  // globalOpacityArray: string,
  composite: GlobalCompositeOperation;
  setComposite: React.Dispatch<React.SetStateAction<GlobalCompositeOperation>>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={clsx(
        "absolute left-0 z-50 flex h-full w-[240px] flex-col gap-2 bg-neutral-50 p-4 text-neutral-700 transition-transform",
        {
          "-translate-x-full": !open,
        },
      )}
    >
      <button
        className="absolute right-0 top-6 translate-x-full rounded-r-full bg-neutral-50 p-2 hover:bg-neutral-100 active:bg-neutral-200"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <ChevronLeftIcon
          className={clsx("transition-transform", {
            "rotate-180": !open,
          })}
        />
      </button>
      <h2 className="mb-4 text-xl">Gradient Setting</h2>

      <h3 className="font-bold">Color</h3>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={props.stop1}
          onChange={(e) => props.setStop1(e.currentTarget.value)}
        />
        <ArrowRightIcon />
        <input
          type="color"
          value={props.stop2}
          onChange={(e) => props.setStop2(e.currentTarget.value)}
        />
      </div>

      <label className="mt-2 flex flex-col gap-2">
        <span className="font-bold">Opacity</span>
        <input
          type="number"
          className="rounded-full bg-neutral-200 px-4 py-2"
          min={0}
          max={100}
          value={props.globalOpacity}
          onChange={(e) => props.setGlobalOpacity(+e.currentTarget.value)}
        />
      </label>

      <label className="mt-2 flex flex-col gap-2">
        <span className="font-bold">Composition Method</span>
        <select className="rounded-full bg-neutral-200 px-4 py-2">
          {Object.entries(compositionOption).map(([key]) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      <div className="text-sm">{compositionOption[props.composite]}</div>
    </div>
  );
}

const compositionOption: Record<GlobalCompositeOperation, string> = {
  hue: "Preserves the luma and chroma of the bottom layer, while adopting the hue of the top layer.",
  saturation:
    "Preserves the luma and hue of the bottom layer, while adopting the chroma of the top layer.",
  color:
    "Preserves the luma of the bottom layer, while adopting the hue and chroma of the top layer.",
  "destination-in":
    "The existing canvas content is kept where both the new shape and existing canvas content overlap. Everything else is made transparent.",
  "color-burn":
    "Divides the inverted bottom layer by the top layer, and then inverts the result.",
  "source-out":
    "The new shape is drawn where it doesn't overlap the existing canvas content.",
  "source-over":
    "This is the default setting and draws new shapes on top of the existing canvas content.",
  "color-dodge": "Divides the bottom layer by the inverted top layer.",
  darken: "Retains the darkest pixels of both layers.",
  lighten: "Retains the lightest pixels of both layers.",
  lighter:
    "Where both shapes overlap the color is determined by adding color values.",
  multiply:
    "The pixels are of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result.",
  copy: "Only the new shape is shown.",
  difference:
    "Subtracts the bottom layer from the top layer or the other way round to always get a positive value.",
  xor: "Shapes are made transparent where both overlap and drawn normal everywhere else.",
  exclusion: "Like difference, but with lower contrast.",
  "hard-light":
    "A combination of multiply and screen like overlay, but with top and bottom layer swapped.",
  overlay:
    "A combination of multiply and screen. Dark parts on the base layer become darker, and light parts become lighter.",
  luminosity:
    "Preserves the hue and chroma of the bottom layer, while adopting the luma of the top layer.",
  "source-atop":
    "The new shape is only drawn where it overlaps the existing canvas content.",
  "destination-over":
    "New shapes are drawn behind the existing canvas content.",
  "source-in":
    "The new shape is drawn only where both the new shape and the destination canvas overlap. Everything else is made transparent.",
  "destination-atop":
    "The existing canvas is only kept where it overlaps the new shape. The new shape is drawn behind the canvas content.",
  "soft-light":
    "A softer version of hard-light. Pure black or white does not result in pure black or white.",
  "destination-out":
    "The existing content is kept where it doesn't overlap the new shape.",
  screen:
    "The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply)",
};
