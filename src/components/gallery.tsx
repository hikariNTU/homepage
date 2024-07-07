import { useEffect, useRef, useState } from "react";
import { register, SwiperContainer } from "swiper/element/bundle";
import { SwiperOptions } from "swiper/types";
import { TooltipWrap } from "@/components/tooltip";
import swiperCustomStyles from "./swiper-custom.css?raw";
import clsx from "clsx";

// @refresh reset
function Gallery() {
  const swiperRef = useRef<SwiperContainer>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      if (!swiperRef.current) {
        return;
      }
      await new Promise((res) => setTimeout(res, 20));
      // Register Swiper web component
      register();

      const params: SwiperOptions = {
        injectStyles: [swiperCustomStyles],

        pagination: true,
        slideToClickedSlide: true,
        initialSlide: 3,
      };
      Object.assign(swiperRef.current, params);

      // initialize swiper
      swiperRef.current.initialize();
      setInitialized(true);
    })();
  }, []);

  return (
    <div
      className={clsx("wave-border py-2 max-md:mx-4", {
        "max-h-[266px] overflow-hidden opacity-0": !initialized,
        "opacity-100": initialized,
      })}
    >
      <swiper-container
        ref={swiperRef}
        navigation
        pagination
        slides-per-view="auto"
        space-between={24}
        centered-slides
        init={false}
      >
        {imageData.map((i) => (
          <swiper-slide key={i.title}>
            <TooltipWrap
              content={
                <section className="max-w-[400px] p-4">
                  <h4 className="lato mb-1 text-xl">{i.title}</h4>
                  <p className="font-thin">{i.text}</p>
                </section>
              }
            >
              <button
                className="wave-border h-[256px] w-fit transition-opacity hover:opacity-90"
                tabIndex={0}
              >
                <img
                  src={i.src}
                  alt={i.title}
                  height={256}
                  className="h-full w-full object-contain"
                />
              </button>
            </TooltipWrap>
          </swiper-slide>
        ))}
      </swiper-container>
    </div>
  );
}

export default Gallery;

const images = import.meta.glob<string>("../assets/gallery/*", {
  eager: true,
  import: "default",
});

const a = {
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

const imageData = Object.entries(a).map(([key, value]) => ({
  src: Object.entries(images).find(([path]) => path.includes(key))?.[1],
  ...value,
}));
