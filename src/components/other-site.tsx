import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import {
  LinkPreviewDialog,
  type PreviewTarget,
  type Tech,
} from "./link-preview-dialog";
import {
  classifyLink,
  resolveFrameSrc,
  resolveNavigableUrl,
} from "@/lib/link-preview";
import { useMediaQuery } from "@/lib/use-media-query";

export function OtherSites() {
  // JS media query (not just CSS) gates whether a click previews or navigates.
  const isMediumUp = useMediaQuery("(min-width: 768px)");
  const [target, setTarget] = useState<PreviewTarget | null>(null);

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    site: (typeof sites)[number],
  ) => {
    const { kind, isFramable } = classifyLink(site.href);
    // External links, small viewports, and modifier/non-primary activations all
    // fall through to normal navigation (the latter so cmd-click opens a tab).
    if (!isFramable || !isMediumUp) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    setTarget({
      title: site.title,
      frameSrc: resolveFrameSrc(site.href, kind),
      navigableUrl: resolveNavigableUrl(site.href, kind),
      tech: site.tech,
    });
  };

  return (
    <div className="w-full columns-xs gap-2 max-md:px-4">
      <LinkPreviewDialog target={target} onClose={() => setTarget(null)} />
      {sites.map((site) => (
        <Link
          to={site.href}
          key={site.title}
          onClick={(e) => handleClick(e, site)}
          className="group relative mb-6 flex break-inside-avoid flex-col p-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-2 z-10 rounded-xl transition-colors group-hover:bg-main-800/5 group-active:bg-main-800/15 dark:group-hover:bg-main-100/10 dark:group-active:bg-main-200/30"
          />
          <div className="wave-border">
            <img
              src={site.img}
              className="object-contain dark:brightness-70"
              alt=""
            />
          </div>
          <div className="mt-3 flex items-center gap-1.5 lato text-xl text-main-800 dark:text-main-200">
            {site.title}
            {!classifyLink(site.href).isFramable && (
              <ExternalLinkIcon
                size={16}
                aria-label="Opens an external site"
                className="shrink-0 text-neutral-500"
              />
            )}
          </div>
          <div className="font-light">{site.description}</div>
        </Link>
      ))}
    </div>
  );
}

const images = Object.entries(
  import.meta.glob<string>("../assets/sites/*", {
    eager: true,
    import: "default",
  }),
);

function find(path: string) {
  const url = images.find(([key]) => key.includes(path))?.[1];
  if (!url) {
    throw `[Image not found]: ${path}`;
  }
  return url;
}

// Reusable tech chips (placeholder content — refine per site as desired). The
// in-SPA toys all share this site's own stack; the standalone hikarintu.github.io
// projects each carry their own.
const TS: Tech = {
  name: "TypeScript",
  abbr: "TS",
  description: "Typed JavaScript for the app logic.",
};
const REACT: Tech = {
  name: "React",
  abbr: "Rea",
  description: "Component-based UI rendering.",
};
const VITE: Tech = {
  name: "Vite",
  abbr: "Vi",
  description: "Dev server and production bundler.",
};
const CANVAS: Tech = {
  name: "Canvas API",
  abbr: "Cv",
  description: "Pixel drawing on an HTML canvas.",
};
const WEB_AUDIO: Tech = {
  name: "Web Audio API",
  abbr: "Au",
  description: "In-browser audio processing.",
};
const VUE: Tech = {
  name: "Vue 2 / Nuxt",
  abbr: "Vue",
  description: "Vue framework with Nuxt.",
};

const sites: {
  img: string;
  title: string;
  description: string;
  href: string;
  tech?: Tech[];
}[] = [
  {
    img: find("api-playground"),
    title: "Browser API Playground",
    description:
      "A full-featured playground for testing and exploring various browser APIs. It provides a convenient environment to experiment with different APIs, view their outputs, and understand their behavior through interactive examples with live coding experience.",
    href: "https://hikarintu.github.io/browser-api-playground/",
    tech: [TS, REACT, VITE],
  },
  {
    img: find("midi-parser"),
    title: "MIDI Parser & Inspector",
    description:
      "A web-based MIDI file parser and inspector. Upload a MIDI file to view its structure, events, and metadata. In the raw format without extra parsing logic.",
    href: "./midi-parser",
    tech: [TS, REACT],
  },
  {
    img: find("qrcode"),
    title: "QR Code Generator",
    description: "Generate QR codes for any text or URL. Easy, Simple.",
    href: "./qrcode",
    tech: [TS, REACT],
  },
  {
    img: find("stereo-splitter"),
    title: "Stereo Splitter",
    description:
      "A web tool to extract different stereo channel from the provided audio file. This tool can be used to detect Out of Phase Stereo file, which result in silent mono file when combining stereo channels into one.",
    href: "https://hikarintu.github.io/audio-splitter/",
    tech: [TS, WEB_AUDIO],
  },
  {
    img: find("ani-skip"),
    title: "Ani Skip Extension",
    description:
      "An extension to mute and wait for animation crazy's ADs.自動跳過並靜音動畫瘋廣告。這個擴充功能會新增一個跳過並靜音動畫瘋廣告的按鈕至播放介面。",
    href: "https://chromewebstore.google.com/detail/kdipgoiohdigddmlpmohjdjfogmmmjfi",
  },
  {
    img: find("sudoku"),
    title: "Sudoku Solver",
    description:
      "Solve Sudoku puzzles with ease on our website! Our solver uses the backtracking algorithm to assign numbers one by one to empty cells. Before assigning a number, it checks whether it is safe to assign.",
    href: "https://hikarintu.github.io/sudoku-solver/",
    tech: [TS],
  },
  {
    img: find("co-iro"),
    title: "Co-Iro EyeDropper",
    description: "Color Picker using EyeDropper API with Vite + Preact",
    href: "https://co-iro.netlify.app/",
  },
  {
    img: find("morse-code"),
    title: "Morse Code",
    description:
      "Translate text into Morse code using web Audio API. Built with Vue2 and Nuxt with Vuetify UI",
    href: "https://hikarintu.github.io/morse-code/",
    tech: [VUE, WEB_AUDIO],
  },
  {
    img: find("badminton-score"),
    title: "Badminton Scoring App",
    description:
      "An simple app to display badminton scoring. Offering multiple tab sync for broadcasting view with second monitor. Built with Vue2 and Nuxt.",
    href: "https://hikarintu.github.io/badminton/",
    tech: [VUE],
  },
  {
    img: find("gradient"),
    title: "Gradient Wallpaper",
    description:
      "Create your own wallpaper using HTML canvas gradient tool as in Photoshop. Directly paint canvas using multiple setting including in canvas compositing option. Now you can create your own amazing artwork.",
    href: "./gradient-wallpaper",
    tech: [TS, REACT, CANVAS],
  },
  {
    img: find("CRT"),
    title: "Bouncing DVD Logo",
    description:
      "A classic bouncing DVD logo. Useful to detect monitor Gray-to-Gray responses time (support 120+ fps) and check if the ghost/blur flaw exist. Although it can be achieved by marquee element, its event listener is no longer available in modern browser.",
    href: "./dvd-logo",
    tech: [TS, REACT],
  },
  {
    title: "Business Card Template",
    img: find("card-cover"),
    description:
      "We love business card, in our deepest heart. Check this example for any new frontend idea. Oh, and only desktop Chrome support. I apologies for it. :(",
    href: "./business-card",
    tech: [TS, REACT],
  },
  {
    title: "Symbols Cheat Sheet",
    img: find("symbols-cover"),
    description:
      "Correctly use symbol in your paper, presentation, flowchart. Search hundreds of symbols by plain description — arrow, degree, shrug — and click one to copy it. The detail view hands you the code point, HTML entity, CSS/JS escape and LaTeX command too.",
    href: "./symbols",
    tech: [TS, REACT],
  },
  {
    title: "Measure Your Screen",
    img: find("screen"),
    description:
      "Do you wander what spec is your screen? Measure it. Do you know every display device can be “Retina Display”? Measure it. Can a golden curvature screen increase your FOV? Measure it.",
    href: "./screen/",
    tech: [TS, REACT],
  },
];
