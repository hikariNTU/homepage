import { createLazyFileRoute } from "@tanstack/react-router";
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

  const handleKey = (e: KeyboardEvent) => {
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
      {/* <div
        {...{
          stop1,
          stop2,
          setStop1,
          setStop2,
          setGlobalOpacity,
          globalOpacity,
          globalOpacityArray,
          composite,
          setComposite,
        }}
      /> */}
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
