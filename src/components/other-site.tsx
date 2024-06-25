import { Link } from "@tanstack/react-router";

export function OtherSites() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-2 gap-y-6 max-md:px-4">
      {sites.map((site) => (
        <Link
          to={site.href}
          key={site.title}
          className="group relative flex flex-col p-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-2 z-10 rounded-xl transition-colors group-hover:bg-main-800/5 group-active:bg-main-800/15"
          />
          <div className="wave-border">
            <img src={site.img} className="object-contain" alt="" />
          </div>
          <div className="lato mt-3 text-xl text-main-800">{site.title}</div>
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
  return images.find(([key]) => key.includes(path))?.[1] || "";
}

const sites: {
  img: string;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    img: find("sudoku"),
    title: "Sudoku Solver",
    description:
      "Solve Sudoku puzzles with ease on our website! Our solver uses the backtracking algorithm to assign numbers one by one to empty cells. Before assigning a number, it checks whether it is safe to assign.",
    href: "https://hikarintu.github.io/sudoku-solver/",
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
  },
  {
    img: find("badminton-score"),
    title: "Badminton Scoring App",
    description:
      "An simple app to display badminton scoring. Offering multiple tab sync for broadcasting view with second monitor. Built with Vue2 and Nuxt.",
    href: "https://hikarintu.github.io/badminton/",
  },
  {
    img: find("gradient"),
    title: "Gradient Wallpaper",
    description:
      "Create your own wallpaper using HTML canvas gradient tool as in Photoshop. Directly paint canvas using multiple setting including in canvas compositing option. Now you can create your own amazing artwork.",
    href: "./gradient-wallpaper",
  },
  {
    img: find("CRT"),
    title: "Bouncing DVD Logo",
    description:
      "A classic bouncing DVD logo. Useful to detect monitor Gray-to-Gray responses time (support 120+ fps) and check if the ghost/blur flaw exist. Although it can be achieved by marquee element, its event listener is no longer available in modern browser.",
    href: "./dvd-logo",
  },
  {
    title: "Business Card Template",
    img: find("card-cover"),
    description:
      "We love business card, in our deepest heart. Check this example for any new frontend idea. Oh, and only desktop Chrome support. I apologies for it. :(",
    href: "./business-card",
  },
  {
    title: "Symbols Cheat Sheet",
    img: find("symbols-cover"),
    description:
      "Correctly use symbol in your paper, presentation, flowchart. This cheating set display some common symbols that you might want to find in the first place. Copy your symbols by clicking it.",
    href: "./symbols",
  },
  {
    title: "Measure Your Screen",
    img: find("screen"),
    description:
      "Do you wander what spec is your screen? Measure it. Do you know every display device can be “Retina Display”? Measure it. Can a golden curvature screen increase your FOV? Measure it.",
    href: "./screen/",
  },
];
