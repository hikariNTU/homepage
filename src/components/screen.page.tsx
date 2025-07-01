import React, { useState, useEffect } from "react";
import { atom, useAtom } from "jotai";
import * as Slider from "@radix-ui/react-slider";
import { Checkbox } from "@radix-ui/react-checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import {
  Trash2,
  Monitor,
  Smartphone,
  Tablet,
  Gamepad2,
  Laptop,
  CheckIcon,
  LockIcon,
} from "lucide-react";
import { TooltipWrap } from "./tooltip";

// Types
interface DeviceSpec {
  name: string;
  width: number;
  height: number;
  aspect: {
    w: number;
    h: number;
    lock: boolean;
  };
  size: number;
  curvature: {
    use: boolean;
    r: number;
  };
}

interface DisplayState {
  name: string;
  width: number;
  height: number;
  aspect: {
    w: number;
    h: number;
    lock: boolean;
  };
  size: number;
  curvature: {
    use: boolean;
    r: number;
  };
  deviceList: DeviceSpec[];
}

// Site data
const screenSiteData = {
  SEO: {
    title: "Screen Measurement",
    description:
      "Measure your screen with width, height, dpi, fov and retina display distance. Including curvature support.",
  },
  Header: {
    title: "How does my screen look like?",
    description:
      "Calculate your screen spec to measure plenty of fancy properties. Measure your screen with width, height, dpi, fov and retina display distance. Including curvature support.",
  },
  Properties: {
    Horizontal: "Horizontal Resolution, in pixels.",
    Vertical: "Vertical Resolution, in pixels.",
    "Screen area": "Total visible area of the screen.",
    "Pixel per Inch(PPI, DPI)": "Pixels lie in 1 inch, higher is better.",
    "Pixel per degree (PPD)":
      "The pixel come to 1 view degree in given distance. 60 px and above is considered as a retina display, which is the resolution of our central retina.",
    "Field of view (FOV)": "How much view degree is occupied by screen width.",
    "Promoted width": "The imaginary width extend from curve screen.",
    "Become retina display":
      "If you see your screen after this distance, you will not be able to distinguish pixel. Which is so called a retina display.",
  },
};

// Device presets
const devicePresets: DeviceSpec[] = [
  {
    name: "PHILIPS 325M8C",
    width: 2560,
    height: 1440,
    aspect: { w: 16, h: 9, lock: true },
    size: 32,
    curvature: { use: true, r: 1500 },
  },
  {
    name: "iPad (3rd gen.)",
    width: 2048,
    height: 1536,
    aspect: { w: 4, h: 3, lock: true },
    size: 9.7,
    curvature: { use: false, r: 0 },
  },
  {
    name: "iPhone 5 (SE)",
    width: 640,
    height: 1136,
    aspect: { w: 9, h: 16, lock: true },
    size: 4,
    curvature: { use: false, r: 0 },
  },
  {
    name: "Nintendo Switch",
    width: 1280,
    height: 720,
    aspect: { w: 16, h: 9, lock: true },
    size: 6.2,
    curvature: { use: false, r: 0 },
  },
  {
    name: 'Apple Retina MacBook Pro 13"',
    width: 2560,
    height: 1600,
    aspect: { w: 16, h: 10, lock: true },
    size: 13.3,
    curvature: { use: false, r: 0 },
  },
  {
    name: "Apple Pro Display XDDD at your money",
    width: 6016,
    height: 3384,
    aspect: { w: 16, h: 9, lock: true },
    size: 32,
    curvature: { use: false, r: 0 },
  },
  {
    name: "Google Pixelbook",
    width: 2400,
    height: 1600,
    aspect: { w: 3, h: 2, lock: true },
    size: 12.3,
    curvature: { use: false, r: 0 },
  },
  {
    name: "Sony PlayStation Portable",
    width: 480,
    height: 272,
    aspect: { w: 16, h: 9, lock: true },
    size: 3.8,
    curvature: { use: false, r: 0 },
  },
  {
    name: "Samsung G8 (32 inch 4K OLED)",
    width: 3840,
    height: 2160,
    aspect: { w: 16, h: 9, lock: true },
    size: 32,
    curvature: { use: false, r: 0 },
  },
];

// Jotai atoms
const displayAtom = atom<DisplayState>({
  name: "screen",
  width: 1920,
  height: 1080,
  aspect: { w: 16, h: 9, lock: true },
  size: 24,
  curvature: { use: false, r: 1500 },
  deviceList: [],
});

const viewDistanceAtom = atom<number>(150);

// Custom hooks
const useDisplayState = () => {
  const [display, setDisplay] = useAtom(displayAtom);

  const updateWidth = (width: number) => {
    setDisplay((prev) => {
      const newState = { ...prev, width };
      if (prev.aspect.lock) {
        newState.height = Math.round((width * prev.aspect.h) / prev.aspect.w);
      }
      return newState;
    });
  };

  const updateHeight = (height: number) => {
    setDisplay((prev) => {
      const newState = { ...prev, height };
      if (prev.aspect.lock) {
        newState.width = Math.round((height * prev.aspect.w) / prev.aspect.h);
      }
      return newState;
    });
  };

  const updateSize = (size: number) => {
    setDisplay((prev) => ({ ...prev, size: size >= 0 ? size : 0 }));
  };

  const updateName = (name: string) => {
    setDisplay((prev) => ({ ...prev, name }));
  };

  const updateAspect = (w: number, h: number, lock: boolean) => {
    setDisplay((prev) => ({ ...prev, aspect: { w, h, lock } }));
  };

  const updateCurvature = (r: number, use: boolean) => {
    setDisplay((prev) => ({ ...prev, curvature: { r, use } }));
  };

  const loadPreset = (preset: DeviceSpec) => {
    setDisplay((prev) => ({ ...prev, ...preset }));
  };

  const saveDevice = () => {
    setDisplay((prev) => ({
      ...prev,
      deviceList: [
        ...prev.deviceList,
        {
          name: prev.name,
          width: prev.width,
          height: prev.height,
          aspect: prev.aspect,
          size: prev.size,
          curvature: prev.curvature,
        },
      ],
    }));
  };

  const deleteDevice = (index: number) => {
    setDisplay((prev) => ({
      ...prev,
      deviceList: prev.deviceList.filter((_, i) => i !== index),
    }));
  };

  return {
    display,
    updateWidth,
    updateHeight,
    updateSize,
    updateName,
    updateAspect,
    updateCurvature,
    loadPreset,
    saveDevice,
    deleteDevice,
  };
};

const useLocalStorage = () => {
  const [display] = useAtom(displayAtom);
  const [, setDisplay] = useAtom(displayAtom);
  const [init, setInit] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem("screen-redux");
    if (data) {
      try {
        const screenData = JSON.parse(data);
        setDisplay(screenData);
      } catch (e) {
        console.error("Failed to load screen data from localStorage", e);
      }
    }
    setInit(true);
  }, [setDisplay]);

  useEffect(() => {
    if (init) {
      localStorage.setItem("screen-redux", JSON.stringify(display));
    }
  }, [display, init]);
};

// Components
const DescriptionList: React.FC<{
  title?: string;
  data: Record<string, string>;
}> = ({ title = "Specification", data }) => {
  return (
    <div className="m-2 block min-w-[230px] rounded-lg bg-white px-4 pb-6 pt-2 shadow">
      <span className="text-xs font-light text-gray-500">{title}</span>
      <div className="mb-3 block h-1 bg-gray-400/20"></div>
      <dl className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            {Object.keys(screenSiteData.Properties).includes(key) ? (
              <TooltipWrap
                content={
                  screenSiteData.Properties[
                    key as keyof typeof screenSiteData.Properties
                  ]
                }
              >
                <dt className="cursor-help text-sm font-medium text-blue-600">
                  {key}
                </dt>
              </TooltipWrap>
            ) : (
              <dt className="text-sm font-medium text-blue-600">{key}</dt>
            )}
            <dd className="mt-1 text-sm font-light text-gray-700">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

const ViewDistanceWidget: React.FC = () => {
  const max = 600;
  const [distance, setDistance] = useAtom(viewDistanceAtom);

  return (
    <div className="mt-6 border-t pt-4">
      <label className="mb-4 flex min-w-0 flex-col items-start text-sm font-medium text-gray-700">
        View Distance
        <div className="flex items-center">
          <input
            id="view-distance"
            type="number"
            value={distance}
            onClick={(e) => e.currentTarget.select()}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="w-20 max-w-full rounded border border-gray-300 px-3 py-1 text-sm"
            style={{ minWidth: 0 }}
          />
          <span className="ml-2 text-sm text-gray-500">cm</span>
        </div>
      </label>
      <Slider.Root
        value={[distance > max ? max : distance]}
        onValueChange={([value]) => setDistance(value)}
        max={max}
        step={5}
        className="relative flex w-full touch-none select-none items-center"
      >
        <Slider.Track className="relative h-2 w-full grow rounded-full bg-gray-200">
          <Slider.Range className="absolute h-full rounded-full bg-blue-500" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-5 w-5 rounded-full border-2 border-blue-500 bg-white shadow transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="View Distance"
        />
      </Slider.Root>
    </div>
  );
};

const ScreenVisualization: React.FC = () => {
  const { display } = useDisplayState();
  const [distance] = useAtom(viewDistanceAtom);

  const dpi =
    Math.sqrt(display.width ** 2 + display.height ** 2) / display.size;
  const ppd = 0.006872 * distance * dpi;
  const retinaDistance = 60 / dpi / 0.006872;
  const phyWidth = (display.width / dpi) * 2.54;
  const phyHeight = (display.height / dpi) * 2.54;
  const screenArea = (phyWidth * phyHeight) / 100; // in cm²

  const aspectRatio = display.width / display.height;
  const maxWidth = 600;
  const maxHeight = 400;

  let visualWidth, visualHeight;
  if (aspectRatio > maxWidth / maxHeight) {
    visualWidth = maxWidth;
    visualHeight = maxWidth / aspectRatio;
  } else {
    visualHeight = maxHeight;
    visualWidth = maxHeight * aspectRatio;
  }

  const fov = 2 * Math.atan(phyWidth / 2 / distance) * (180 / Math.PI);

  return (
    <div className="mx-auto my-8 flex flex-col items-center">
      {/* Screen visualization */}
      <div
        className="relative border-2 border-gray-500 bg-gray-900 text-white shadow-xl transition-colors duration-300 hover:bg-gray-800"
        style={{
          width: `${visualWidth}px`,
          height: `${visualHeight}px`,
          borderRadius: display.curvature.use ? "8px" : "0px",
        }}
      >
        {/* Screen glare effect */}
        <div
          className="pointer-events-none absolute inset-0 select-none"
          style={{
            background:
              "linear-gradient(242deg, rgba(238, 238, 238, 0) 0%, rgba(238, 238, 238, 0) 8%, rgba(250, 250, 250, 0.2) 10%, rgba(250, 250, 250, 0.2) 14%, rgba(238, 238, 238, 0) 16%, rgba(238, 238, 238, 0) 17%, rgba(255, 255, 255, 0.1) 19%, rgba(255, 255, 255, 0.1) 21%, rgba(238, 238, 238, 0) 23%, rgba(238, 238, 238, 0) 100%)",
          }}
        />

        {/* Screen name in center */}
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
          {display.name}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-2 left-2 text-xs">
          {display.width} × {display.height}
        </div>

        {/* Right info */}
        <div className="absolute bottom-2 right-2 text-xs">{display.size}"</div>

        {/* DPI indicator */}
        <div className="absolute right-2 top-2 text-xs">
          {Math.round(dpi)} DPI
        </div>
      </div>

      {/* Calculations display */}
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <DescriptionList
          title="Screen Properties"
          data={{
            Horizontal: `${display.width} pixels`,
            Vertical: `${display.height} pixels`,
            "Screen area": `${screenArea.toFixed(1)} cm²`,
            "Pixel per Inch(PPI, DPI)": `${Math.round(dpi)} PPI`,
          }}
        />

        <DescriptionList
          title="View Properties"
          data={{
            "Pixel per degree (PPD)": `${ppd.toFixed(1)} px/deg`,
            "Field of view (FOV)": `${fov.toFixed(1)}°`,
            "Become retina display": `${retinaDistance.toFixed(1)} cm`,
            ...(display.curvature.use && {
              "Promoted width": `${(
                phyWidth *
                Math.PI *
                (1 / 180) *
                Math.asin(phyWidth / 2 / display.curvature.r) *
                2
              ).toFixed(1)} cm`,
            }),
          }}
        />
      </div>
    </div>
  );
};

const ControlPanel: React.FC = () => {
  const {
    display,
    updateWidth,
    updateHeight,
    updateSize,
    updateName,
    updateAspect,
    updateCurvature,
    saveDevice,
    deleteDevice,
    loadPreset,
  } = useDisplayState();

  const [showPresets, setShowPresets] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  return (
    <div className="mx-auto max-w-96 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
      <div className="grid grid-cols-1 gap-4">
        {/* Basic controls */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Screen Name
            </label>
            <input
              type="text"
              value={display.name}
              onChange={(e) => updateName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Width (px)
              </label>
              <input
                type="number"
                value={display.width}
                onChange={(e) => updateWidth(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full rounded border border-gray-300 px-3 py-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Height (px)
              </label>
              <input
                type="number"
                value={display.height}
                onChange={(e) => updateHeight(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full rounded border border-gray-300 px-3 py-1"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Size (inches)
            </label>
            <input
              type="number"
              value={display.size}
              onChange={(e) => updateSize(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-full rounded border border-gray-300 px-3 py-1"
              step="0.1"
            />
          </div>
        </div>

        {/* Advanced controls */}
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Aspect Ratio
            </label>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="number"
                  value={display.aspect.w}
                  onChange={(e) =>
                    updateAspect(
                      Number(e.target.value),
                      display.aspect.h,
                      display.aspect.lock,
                    )
                  }
                  className="min-w-0 flex-shrink rounded border border-gray-300 px-3 py-1"
                />
                <div className="shrink-0">:</div>
                <input
                  type="number"
                  value={display.aspect.h}
                  onChange={(e) =>
                    updateAspect(
                      display.aspect.w,
                      Number(e.target.value),
                      display.aspect.lock,
                    )
                  }
                  className="min-w-0 flex-shrink rounded border border-gray-300 px-3 py-1"
                />
              </div>
              <div className="flex items-center">
                <label className="ml-1 flex items-center gap-2 text-sm">
                  <Checkbox
                    className="flex h-4 w-4 items-center justify-center rounded border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    checked={display.aspect.lock}
                    onCheckedChange={(checked) =>
                      updateAspect(
                        display.aspect.w,
                        display.aspect.h,
                        checked === true,
                      )
                    }
                  >
                    {display.aspect.lock && (
                      <CheckIcon
                        size={12}
                        className="pointer-events-none text-white"
                        aria-hidden
                      />
                    )}
                  </Checkbox>
                  <LockIcon size={16} />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Checkbox
                className="flex h-4 w-4 items-center justify-center rounded border border-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                checked={display.curvature.use}
                onCheckedChange={(checked) =>
                  updateCurvature(display.curvature.r, checked === true)
                }
              >
                {display.curvature.use && (
                  <CheckIcon
                    size={12}
                    className="pointer-events-none text-white"
                    aria-hidden
                  />
                )}
              </Checkbox>
              Curved Screen
            </label>
            {display.curvature.use && (
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Curvature Radius (mm)
                </label>
                <input
                  type="number"
                  value={display.curvature.r}
                  onChange={(e) =>
                    updateCurvature(
                      Number(e.target.value),
                      display.curvature.use,
                    )
                  }
                  className="w-full rounded border border-gray-300 px-3 py-1"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={saveDevice}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Save Device
            </button>

            <Popover open={showPresets} onOpenChange={setShowPresets}>
              <PopoverTrigger asChild>
                <button className="rounded border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50">
                  Presets
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Device Presets</h3>
                  {devicePresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        loadPreset(preset);
                        setShowPresets(false);
                      }}
                      className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-gray-100"
                    >
                      {preset.name.includes("iPhone") ||
                      preset.name.includes("PSP") ? (
                        <Smartphone className="h-4 w-4" />
                      ) : preset.name.includes("iPad") ||
                        preset.name.includes("Switch") ? (
                        <Tablet className="h-4 w-4" />
                      ) : preset.name.includes("MacBook") ||
                        preset.name.includes("Pixelbook") ? (
                        <Laptop className="h-4 w-4" />
                      ) : preset.name.includes("Switch") ? (
                        <Gamepad2 className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-sm text-gray-500">
                          {preset.size}", {preset.width}×{preset.height}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={showSaved} onOpenChange={setShowSaved}>
              <PopoverTrigger asChild>
                <button className="rounded border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50">
                  Saved
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Saved Devices</h3>
                  {display.deviceList.length === 0 ? (
                    <p className="text-sm text-gray-500">No saved devices</p>
                  ) : (
                    display.deviceList.map((device, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded p-2 hover:bg-gray-100"
                      >
                        <button
                          onClick={() => {
                            loadPreset(device);
                            setShowSaved(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium">{device.name}</div>
                          <div className="text-sm text-gray-500">
                            {device.size}", {device.width}×{device.height}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteDevice(index)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <ViewDistanceWidget />
    </div>
  );
};

export function ScreenPage() {
  useLocalStorage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-800 via-blue-900 to-blue-800">
      {/* Header */}
      <header className="px-8 py-20 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold drop-shadow-lg">
          {screenSiteData.Header.title}
        </h1>
        <p className="mx-auto max-w-4xl px-8 text-lg opacity-90">
          {screenSiteData.Header.description}
        </p>
      </header>

      {/* Main content */}
      <div className="container mx-auto flex flex-col gap-8 px-4 pb-16 lg:flex-row lg:items-start lg:justify-center">
        <ControlPanel />
        <ScreenVisualization />
      </div>

      <section className="mx-auto max-w-[500px] rounded-lg bg-white/60 p-4 text-xs">
        This site has been migrated from the original jsx version to TypeScript
        and React by Gemini 2.5 Pro.
        <time
          className="ml-2 text-xs text-gray-500"
          dateTime={"2025-07-01T13:50:28.526Z"}
        >
          {new Date("2025-07-01T13:50:28.526Z").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </section>
    </div>
  );
}
