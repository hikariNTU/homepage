import nameImg from "@/assets/sider.webp";
import waveBlockImg from "@/assets/wave-block.svg";
import waveHorImg from "@/assets/wave-hor.svg";
import waveImg from "@/assets/wave.svg";
import { OtherSites } from "@/components/other-site";
import { TooltipWrap } from "@/components/tooltip";
import { SwitchLang } from "@/components/translations";
import { TranslationsKey, useTranslation } from "@/translations";
import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { MoonIcon, SunIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Homepage,
});

const Gallery = lazy(() => import("@/components/gallery"));
const ModelsViewer = lazy(() => import("@/components/models"));

function Homepage() {
  const [hasChangedTheme, setHasChangedTheme] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    window.localStorage.getItem("theme") === "dark" ? "dark" : "light",
  );

  useLayoutEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    }
    return () => {
      document.body.classList.remove("dark");
    };
  }, [theme]);

  return (
    <div
      className={clsx(
        "flex min-h-screen flex-col overscroll-none bg-main-100 text-main-900 md:flex-row dark:bg-neutral-900 dark:text-main-100",
      )}
    >
      {hasChangedTheme && <TransitionMask key={theme} />}
      <div className="top-0 flex h-screen items-center justify-center md:sticky">
        <div className="relative">
          <img
            src={nameImg}
            width={409}
            height={1440}
            className="mx-16 my-10 max-w-[150px] xl:mx-[5vw] dark:brightness-[5] dark:grayscale"
            alt="Dennis Chung Personal webpage"
          />
          <div className="absolute bottom-0 flex w-full items-center justify-center md:pr-4">
            <SwitchLang />
            <SwitchTheme
              theme={theme}
              setTheme={(value) => {
                window.localStorage.setItem("theme", value);
                setTheme(value);
                setHasChangedTheme(true);
              }}
            />
          </div>
        </div>
        <hr
          aria-orientation="vertical"
          className="absolute right-4 top-0 my-16 h-[calc(100%-8rem)] w-5 overflow-hidden border-none bg-repeat-y object-cover max-md:hidden dark:brightness-[0.3]"
          style={{
            backgroundImage: `url("${waveImg}")`,
            backgroundSize: "10px",
          }}
        ></hr>
      </div>
      <div className="md:p-12">
        <div className="wave-border max-md:mx-4">
          <img
            src="./lake_orange.webp"
            className="dark:brightness-75"
            alt="Lake Img"
            width={2588}
            height={840}
          />
        </div>

        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2">
          <SelfIntro />
          <SkillSet />
        </div>

        <SectionChunk title="photoTitle" condensed>
          <Suspense fallback={"..."}>
            <Gallery />
          </Suspense>
        </SectionChunk>

        <SectionChunk title="sitesTitle" condensed>
          <OtherSites />
        </SectionChunk>

        <SectionChunk title="modelsTitle" condensed>
          <Suspense fallback={"..."}>
            <ModelsViewer />
          </Suspense>
        </SectionChunk>
        <Footer />
      </div>
    </div>
  );
}

function SwitchTheme({
  theme,
  setTheme,
}: {
  theme: "dark" | "light";
  setTheme: (value: "dark" | "light") => void;
}) {
  return (
    <TooltipWrap content="Dark Mode Switch">
      <button
        className="flex items-center gap-1 rounded-full px-4 py-1 font-light text-neutral-500 transition-colors hover:bg-neutral-950/5 active:bg-main-900/20 dark:hover:bg-neutral-50/10"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <span
          className={clsx({
            "font-black text-main-800 dark:text-main-200": theme === "dark",
          })}
        >
          <MoonIcon aria-description="dark-mode" />
        </span>
        <span
          className={clsx({
            "font-black text-main-800 dark:text-main-200": theme === "light",
          })}
        >
          <SunIcon aria-description="light-mode" />
        </span>
      </button>
    </TooltipWrap>
  );
}

function TransitionMask() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setLoaded(true);
    }, 100);
  }, []);
  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none fixed inset-0 z-50 select-none bg-neutral-900 transition-opacity ease-in-out [transition-duration:1.5s] dark:bg-main-100",
        {
          "opacity-0": loaded,
        },
      )}
    />
  );
}

function SectionChunk({
  title,
  children,
  condensed,
}: React.PropsWithChildren<{ title: TranslationsKey; condensed?: boolean }>) {
  const { fastT } = useTranslation();
  const titleText = fastT(title);
  return (
    <section
      className={clsx("my-8 flex gap-4 max-xs:flex-col max-xs:gap-0", {
        "max-xl:flex-col max-xl:gap-0": condensed,
      })}
    >
      <div
        className={clsx("shrink-0 p-4 max-xs:flex max-xs:gap-4 max-xs:pb-0", {
          "max-xl:flex max-xl:gap-4 max-xl:pb-0": condensed,
        })}
      >
        <h2
          className={clsx(
            "shrink-0 text-2xl font-light leading-[2.5] tracking-[40px] text-main-800 [writing-mode:vertical-lr] max-xs:leading-[2.5] max-xs:tracking-[32px] dark:text-main-200",
            {
              "max-xl:leading-[2.5] max-xl:tracking-[32px]": condensed,
            },
          )}
        >
          {titleText.slice(0, 2)}
          <br />
          {titleText.slice(2)}
        </h2>
        <img
          src={waveBlockImg}
          aria-hidden
          width={120}
          height={148}
          alt=""
          className={clsx(
            "pointer-events-none -mt-4 select-none p-2 max-xs:-mt-8 max-xs:rotate-90 max-xs:p-3 dark:brightness-150",
            {
              "max-xl:-mt-8 max-xl:rotate-90 max-xl:p-3": condensed,
            },
          )}
        />
      </div>
      {children}
    </section>
  );
}

function SelfIntro() {
  const { t } = useTranslation();
  return (
    <SectionChunk title="selfTitle">
      <div className="flex flex-col p-4 text-sm font-light leading-relaxed tracking-wider">
        <p className="mb-4">{t("migrationNote")}</p>
        <p className="mb-4">{t("selfP2")}</p>
        <details>
          <summary className="mb-4 cursor-pointer rounded px-2 hover:bg-neutral-500/10">
            {t("readMore")}
          </summary>
          <p className="mb-4">{t("selfP1")}</p>

          <p className="">{t("selfP3")}</p>
        </details>
      </div>
    </SectionChunk>
  );
}

const skillIcons = import.meta.glob<{ default: string }>(
  "../assets/skill_icon/*.svg",
  {
    eager: true,
  },
);

const skillList: {
  group: string;
  skills: {
    name: string;
    icon?: string;
    desc?: string;
  }[];
}[] = [
  {
    group: "Programming Language",
    skills: [
      {
        name: "Python 3",
        icon: "python",
        desc: "Feel familiar with Python Class due to the usage of Blender Python API. I've create some useful addon in my Github page, although the addon used in master thesis was not available since it's not ready for publication.",
      },
      {
        name: "Javascript/Typescript",
        icon: "es6",
        desc: "It's over 9000.",
      },
      {
        name: "C++",
        icon: "c",
        desc: "The first Programming Language that I learned, which give me the view of data structure and the pointer concept in further language I learned. C# is used for Unity and Qt project.",
      },
    ],
  },
  {
    group: "Markups / Template",
    skills: [
      {
        name: "HTML 5",
        icon: "html5",
        desc: "A cool thing that I've done is written an automate form filler from Excel text to ASP framework in html 4, AT MILITARY. Only with intranet, the computer I used was totally unacceptable with nowadays development experience. And the html 4 with IE was another big no no. I'm glad I quit from there.",
      },
      {
        name: "CSS 3",
        icon: "css3",
        desc: "grid-column-template: repeat(auto, minmax(20rem, 1fr))? Dude, seriously, is this even a simple language? I couldn't correctly write auto repeat style without looking up mdn every single time.",
      },
    ],
  },
  {
    group: "Framework",
    skills: [
      {
        name: "React",
        icon: "react",
        desc: "Do I love it? No. Do I hate it? Uh, No. Maybe just fix some serious DX issue first?",
      },
      {
        name: "Vue",
        icon: "vue",
        desc: "I love Vue, especially Vue 3. But since no one is using Vue, I don't use it anymore.",
      },
      {
        name: "Next.js",
        icon: "next",
        desc: "I hate this s**t. But I think we don't have other choices.",
      },
      {
        name: "Nest.js",
        icon: "nest",
        desc: "@See {Next.js}",
      },
      {
        name: "Vite",
        icon: "vite",
        desc: "Love it, use it. This site is built with it. If you don't use it, you lose it.",
      },
    ],
  },
  {
    group: "CI/CD",
    skills: [
      {
        name: "Kubernetes",
        icon: "k8s",
        desc: "Writing deployment and ingress is just like writing poem.",
      },
      {
        name: "Docker",
        icon: "docker",
        desc: "Why is this layer not been cached?",
      },
      {
        name: "Github Actions",
        icon: "github",
        desc: "Worst documentation I've ever seen.",
      },
      {
        name: "Gitlab Pipeline",
        icon: "git",
        desc: "The second worst documentation I've ever seen",
      },
    ],
  },
  {
    group: "UI/UX Design",
    skills: [
      {
        name: "Figma",
        icon: "figma",
        desc: "Best free Illustrator ever created.",
      },
      {
        name: "PhotoShop",
        icon: "ps",
        desc: "If you need photo editing, this is the only choice.",
      },
      {
        name: "Illustrator",
        icon: "ai",
        desc: "An unnecessary complicated vector editing tool run by Adobe.",
      },
      {
        name: "Blender",
        icon: "blender",
        desc: "Best DX. I would say it is basically 3D modeling version of Vim (with GUI).",
      },
    ],
  },
];

function SkillSet() {
  return (
    <SectionChunk title="specialTitle">
      <div className="p-3">
        {skillList.map((set) => (
          <Fragment key={set.group}>
            <h3 className="mb-2 mt-4 text-sm font-light text-main-800 first:mt-0 max-xs:ml-6 dark:text-main-200">
              {set.group}
            </h3>
            <ul className="flex flex-wrap whitespace-nowrap max-xs:flex-col max-xs:items-start max-xs:pl-6">
              {set.skills.map((skill) => (
                <li key={skill.name}>
                  <TooltipWrap
                    className="text-light max-w-96 !p-6"
                    content={skill.desc || "..."}
                    key={skill.name}
                  >
                    <button className="lato flex cursor-help items-center gap-1 rounded-xl px-2 py-1 text-lg text-main-900 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:text-neutral-300 dark:hover:text-main-100">
                      {
                        <img
                          width={20}
                          height={20}
                          src={
                            skillIcons[
                              `../assets/skill_icon/icon-${skill.icon}.svg`
                            ]?.default
                          }
                          className="dark:brightness-[6] dark:grayscale"
                          alt=""
                        />
                      }
                      {skill.name}
                    </button>
                  </TooltipWrap>
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </div>
    </SectionChunk>
  );
}

function Footer() {
  return (
    <footer>
      <hr
        className="h-2.5 w-full border-none bg-repeat-x object-cover"
        style={{
          backgroundImage: `url("${waveHorImg}")`,
        }}
      ></hr>
      <div className="lato mb-8 mt-4 flex flex-wrap items-center justify-center text-main-800/70 md:mb-0 dark:text-main-200">
        <a
          href="https://www.linkedin.com/in/dennis-chung-tw/"
          className="flex items-center gap-2 rounded-xl p-2 hover:bg-neutral-400/10 hover:text-main-800 dark:hover:bg-neutral-800 dark:hover:text-main-100"
        >
          <LinkedInIcon />
          LINKEDIN
        </a>
        <a
          href="https://github.com/hikariNTU"
          className="flex items-center gap-2 rounded-xl p-2 hover:bg-neutral-400/10 hover:text-main-800 dark:hover:bg-neutral-800 dark:hover:text-main-100"
        >
          <GithubIcon />
          GITHUB
        </a>
      </div>
    </footer>
  );
}

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    focusable="false"
    viewBox="0 0 21 21"
    aria-hidden="true"
    data-testid="LinkedInIcon"
    width="1em"
    height="1em"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    focusable="false"
    viewBox="0 0 35 35"
    aria-hidden="true"
    width="1em"
    height="1em"
    fill="currentColor"
    {...props}
  >
    <g id="b95101dd-f8a6-4e76-b9af-acc1de72db5c" data-name="Github Icon">
      <path d="M13.28,32v1.33a.93.93,0,0,1-1.35,1,15.6,15.6,0,0,1-3.44-1.6A17.55,17.55,0,0,1,.92,23.27,17.1,17.1,0,0,1,0,18.78,17,17,0,0,1,2.73,8.21,17.29,17.29,0,0,1,14.3.33,16.54,16.54,0,0,1,18.69,0,17.66,17.66,0,0,1,35,14.73a17.32,17.32,0,0,1,.16,4.49A17.23,17.23,0,0,1,31,29.05a17.4,17.4,0,0,1-7.64,5.23,1.44,1.44,0,0,1-.51.09.84.84,0,0,1-.92-.8,4.81,4.81,0,0,1,0-.76c0-1.46,0-2.91,0-4.36a4.33,4.33,0,0,0-.73-2.54l-.24-.3c0-.06-.17-.11-.12-.21s.16-.07.24-.08a12.3,12.3,0,0,0,3.39-.84,6.67,6.67,0,0,0,4.06-5.17,10.32,10.32,0,0,0,.08-4.18,6.54,6.54,0,0,0-1.45-2.92.43.43,0,0,1-.1-.47,6.47,6.47,0,0,0-.18-4.19.33.33,0,0,0-.38-.23,5.77,5.77,0,0,0-2.35.61A12.67,12.67,0,0,0,22.28,9a.6.6,0,0,1-.55.09,15.37,15.37,0,0,0-4.1-.52,15.16,15.16,0,0,0-4.08.51A.72.72,0,0,1,12.9,9,10.28,10.28,0,0,0,9.52,7.41a3.46,3.46,0,0,0-.85-.09.33.33,0,0,0-.35.24,6.74,6.74,0,0,0-.42,2.92,5.3,5.3,0,0,0,.28,1.37.29.29,0,0,1-.1.32,6.26,6.26,0,0,0-1.6,3.63,10.18,10.18,0,0,0,.92,5.65,6.56,6.56,0,0,0,3.68,3.18,13.26,13.26,0,0,0,2.86.69l.29,0c.16,0,.14.1,0,.19a3.89,3.89,0,0,0-.93,2c0,.13,0,.23-.18.28a3.93,3.93,0,0,1-3.65-.07,3.65,3.65,0,0,1-1.28-1.31A4.18,4.18,0,0,0,6.5,24.78a2.5,2.5,0,0,0-1.26-.25c-.19,0-.43,0-.5.24s.11.36.26.48.59.42.87.65a4.88,4.88,0,0,1,1.34,2,3.81,3.81,0,0,0,3.18,2.47,7.35,7.35,0,0,0,2.52-.08c.33-.07.36,0,.36.29V32Z" />
      <path d="M10.08,28.83c-.27,0-.49-.18-.47-.35s.16-.22.32-.22.47.17.44.34A.26.26,0,0,1,10.08,28.83Z" />
      <path d="M12.73,28.89c-.17,0-.35-.05-.35-.25s.21-.31.42-.32.34,0,.34.24S12.92,28.85,12.73,28.89Z" />
      <path d="M11.46,28.48c.17,0,.36.08.33.29s-.22.29-.42.28S11,29,11,28.75,11.26,28.48,11.46,28.48Z" />
      <path d="M8.73,27.5c.14,0,.35.19.37.4s-.06.26-.23.26a.49.49,0,0,1-.44-.43C8.43,27.58,8.51,27.5,8.73,27.5Z" />
    </g>
  </svg>
);
