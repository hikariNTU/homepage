import { TooltipWrap } from "@/components/tooltip";
import { useRef } from "react";

function Gallery() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      className={
        "flex h-[256px] snap-x snap-proximity gap-4 overflow-auto scroll-smooth py-2 max-md:mx-4"
      }
      ref={ref}
    >
      {imageData.map((i) => (
        <TooltipWrap
          key={i.title}
          content={
            <section className="max-w-[400px] p-4">
              <h4 className="lato mb-1 text-xl">{i.title}</h4>
              <p className="font-thin">{i.text}</p>
            </section>
          }
        >
          <button
            className="wave-border h-full min-w-fit snap-start transition-opacity hover:opacity-90"
            id={i.src}
            tabIndex={0}
            onClick={() => {
              const btn = document.getElementById(i.src) as HTMLButtonElement;
              ref.current?.scrollTo({
                left: btn.offsetLeft - ref.current.offsetLeft,
                behavior: "smooth",
              });
            }}
          >
            <img
              src={i.src}
              alt={i.title}
              height={256}
              className="h-full object-contain"
              loading="lazy"
            />
          </button>
        </TooltipWrap>
      ))}
    </div>
  );
}

export default Gallery;

const images = import.meta.glob<string>("../assets/gallery/*", {
  eager: true,
  import: "default",
});

const data: Record<string, { text: string; title: string }> = {
  JKC_5134: {
    text: "A tired horse in California Disney land, such a beautiful place. Should go there again and again until our dream come true.",
    title: "Horse in Disney",
  },
  JKC_5004: {
    text: "Sunset at Griffith Observatory. Mountain people mountain sea.",
    title: "Sunset 2",
  },
  JKC_5257: {
    text: "Seems like no one know this kind of curry in states. Why? No rice? Call Uncle Roger.",
    title: "Curry (Japanese)",
  },
  dam: {
    text: "Seems like it will control the salt river. Nice place, a bit far from downtown. But definitely worth it.",
    title: "Theodore Roosevelt Dam",
  },
  JKC_5248: {
    text: "It tastes bad. I don't know why, maybe I forgot to check the recipe again before put it into oven.",
    title: "Bread pudding",
  },
  az_tonto_5850: {
    text: "These cactuses were burnt in a fire before I took this picture.",
    title: "Burnt Cactus",
  },
  JKC_5205: {
    text: "Bad-ass pumpkins running a cart in California Disney land. Yet the line for entering facility was way too long. I guess these pumpkins were the staffs who died from overwork in last Halloween.",
    title: "Pumpkin in Disney",
  },
  az_tonto_5830: {
    text: "The view from lower cliff toward Roosevelt Lake. Although it's a national forest, I cannot see any 'tree' there. Picture took in Arizona, 2019-10.",
    title: "Tonto National Monument - Arizona",
  },
  JKC_4932: {
    text: "Sunset at Griffith Observatory.",
    title: "Sunset",
  },
  "card-sample": {
    text: "None of the thing in this picture is real. Violin was modeled by me, and the card, generated bellow, are rendered in Blender. Yes, I do play violin.",
    title: "Card Showcase",
  },
  JKC_4875: {
    text: "\u201cNo Trevor Philips\u201d - A beach as you seen in GTA V, with more and more and more people laying on their tiny towels.",
    title: "Santa Monica Pier",
  },
  JKC_4883: {
    text: "\u201cDid I went into GTA V?\u201d - Santa Monica Pier. How come all good wether goto Los Angeles and left Arizona as a hot pan land?",
    title: "Santa Monica Pier - Patrol SUV",
  },
  gcfull: {
    text: "No need description.",
    title: "The Great Canyon",
  },
};

const imageData = Object.entries(data).map(([key, value]) => ({
  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
  src: Object.entries(images).find(([path]) => path.includes(key))?.[1]!,
  ...value,
}));
