import { PropsWithChildren, ReactNode, useLayoutEffect } from "react";
import clsx from "clsx";
import { startCase } from "lodash";
import styleData from "@/styles/cv.css?inline";
import linkedinIcon from "@/assets/linkedin.png";
import githubIcon from "@/assets/github.png";
import homepageIcon from "@/assets/homepage-manifest-icon.png";

const contexts = {
  revision: "2025.09.12",
  intro:
    "Hi, I'm Dennis Chung, a passionate and results-driven full-stack software engineer with a proven track record of building and optimizing high-performance, scalable, and maintainable systems. I'm an avid learner with a knack for web development and visual arts.",
  skills: {
    languages: ["Typescript", "Python", "HTML5", "CSS3"],
    frameworksAndLibraries: [
      "React",
      "Next.js",
      "Vue",
      "NestJS",
      "Express",
      "Vite",
      "Rollup",
      "TypeORM",
    ],
    toolsAndPlatforms: ["Docker", "Git", "Kubernetes", "AWS-EKS", "MySQL"],
  },
  educations: [
    {
      degree: "Bachelor",
      period: "2013 ~ 2017",
      school: "National Taiwan University",
      department: "Information Management",
    },
    {
      degree: "Master",
      period: "2017 ~ 2019",
      school: "National Taiwan University",
      department: "CMLab@Information Management",
    },
  ],
  experiences: [
    {
      where: "Taiwan AI Labs",
      title: "Lead Software Engineer, Fullstack (Studio Team)",
      period: "2023-09 ~ Now",
      projects: [
        {
          title: "Transkribera - Studio",
          extra: "https://asr.yating.tw",
          items: [
            "**Challenge:** Maintain a production-grade transcription service (**1500 DAU with 8000 files per day**) with stable pipelines, low latency, and accurate results while scaling usage.",
            "**Action:** Owned infra reliability — ensured RabbitMQ pipeline queues and autoscaling worked reliably, monitored underlying DB health and queries, triaged and fixed production bugs, and introduced an AI-based summary feature into the transcription pipeline.",
            "**Result:** Delivered robust service-level reliability and a new **AI summary** feature for transcriptions; reduced operational incidents and improved user experience.",
            "**Metric:** Reduced DB CPU usage by **90%** by monitoring SQL and adding missing indexes / query improvements.",
          ],
        },
        {
          title: "Studio Control Tower Dashboard",
          extra: "Internal — Customer Support",
          items: [
            "**Challenge:** Customer support needed an easy way to inspect and query customer account issues across services. And also create coupons for paid accounts.",
            '**Action:** Designed and implemented a "Control Tower" dashboard aggregating logs, job queue states, DB insights and runtime metrics to enable fast root-cause analysis by non-engineers.',
            "**Result:** Reduced mean time to resolution for support tickets and enabled safe, auditable queries for support staff.",
          ],
        },
        {
          title: "FedGPT - Studio",
          extra: "https://fedgpt.cc",
          items: [
            "**Challenge:** Real-time, low-latency voice interactions and safe rendering of rich model outputs.",
            "**Action:** Engineered streaming audio stacks (ASR → orchestration → TTS), hybrid model routing and safe renderers to support diverse model outputs.",
            "**Result:** Built a scalable, low-latency interaction platform with improved security and extensibility for multi-modal outputs.",
          ],
        },
        {
          title: "AI-music Pavilion Engineering - Hualien AI Music Lab",
          extra: "https://hmusic.moc.gov.tw/",
          items: [
            "**Challenge:** Architected and owned the complex **end-to-end media pipeline** for a large-scale interactive pavilion.",
            "**Action:** Architected **full-stack applications** and AWS Kubernetes deployments with autoscaling and job queuing systems.",
            "**Result:** Ensured a seamless user experience, handling QR session creation, audio/video generation, and synchronized 360° playback for a live public installation.",
          ],
        },
        {
          title: "AI-music Vocal Generation Platform",
          extra: "https://studio.yating.tw/music",
          items: [
            "**Challenge:** Developed a complex **Digital Audio Workstation (DAW)** within the browser for AI-vocal generation.",
            "**Action:** Engineered a front-end to handle a variety of audio and MIDI inputs, utilizing the **Browser Audio Context API** to enable real-time synesthesia. Implemented intricate **canvas drawing** and note manipulation, including drag-and-drop, resize, pitch shifts, and BPM changes.",
            "**Result:** Enabled users to compose, edit, and generate AI-vocal tracks from MIDI files. Also built a 'near zero-shot' feature to guide users in generating complete songs automatically, similar to Suno, broadening user accessibility and creative output.",
          ],
        },
        {
          title: "Yating Studio",
          extra: "https://studio.yating.tw",
          items: [
            "**Challenge:** The existing front-end needed a complete overhaul to improve performance and maintainability.",
            "**Action:** Led the rewrite of multiple front-end applications using **Next.js** and **Vite**, implementing a component-driven design.",
            "**Result:** Achieved **90+ Lighthouse scores** through **SSR/ISR**, code-splitting, and **CDN** optimizations, dramatically improving user-facing performance.",
          ],
        },
      ],
    },
    {
      where: "Houzz",
      title: "Fullstack Engineer (Website Services)",
      period: "2022-04 ~ 2023-08",
      projects: [
        {
          title: "Prepublish Wizard",
          extra:
            "A supporting tool which checks if the site meets recommended criteria",
          items: [
            "**Challenge:** Needed an automated tool to validate sites against recommended criteria.",
            "**Action:** Designed and built a general-purpose interface to implement **8 critical checkers** in the backend.",
            "**Result:** Optimized the tool to achieve a **500ms response time**, processing an average of **1000 API calls per week** and ensuring site quality.",
          ],
        },
      ],
    },
    {
      where: "ASUS AICS",
      title: "Software Engineer",
      period: "2021-03 ~ 2022-04",
      projects: [
        {
          title: "XUI",
          extra: "Dedicated Vue Component Library for xHIS",
          items: [
            "**Challenge:** A dedicated UI framework was needed to match a fine-tuned design specification for the xHIS project.",
            "**Action:** Created a **Vue Component Library**, designing and implementing **15 components** from scratch.",
            "**Result:** Developed complex components with **virtual scroll** and **sticky header** capabilities, improving the developer experience with a monorepo structure.",
          ],
        },
        {
          title: "xHIS Patient Record submodule",
          extra:
            "A sub-system in xHIS to provide CRUD functionality for patient's records",
          items: [
            "**Challenge:** The original system had a slow and inefficient UI for patient record management.",
            "**Action:** Authored a new sub-system using **Electron** and **Vue**, focusing on a lean front-end without a UI framework.",
            "**Result:** **Reduced operation time by 50%** and achieved a final bundle size of only **200KB (gzipped)**, representing a **95% size reduction** compared to typical projects.",
          ],
        },
        {
          title: "xHIS Mobile Rounding",
          extra:
            "A Medical rounding supporting application run on iPad for daily usage",
          items: [
            "**Challenge:** Inpatient rounding procedures were reliant on paper documents, creating inefficiencies.",
            "**Action:** Provided a mobile solution for inpatient rounding on iPad, eliminating the need for paper.",
            "**Result:** The app's deployment led to a **35% reduction in rounding time** and reached **100 monthly active users (MAU)** with **10,000 monthly active records (MAR)** in its first quarter.",
          ],
        },
      ],
    },
  ],
};

function useStyleData() {
  const id = "cv-styles";
  useLayoutEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.id = id;
    styleTag.innerHTML = styleData;

    document.head.appendChild(styleTag);

    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);
}

export function CVPage() {
  useStyleData();
  return (
    <main className="mx-auto max-w-[800px] p-8 text-neutral-950">
      <Title />
      <footer className="absolute top-8 right-8 text-[6px]">
        Rev.{contexts.revision}
      </footer>
      <Header />
      <Section title="Summary">
        <p className="text-xs leading-normal font-light">{contexts.intro}</p>
      </Section>
      <div className="flex flex-wrap justify-between">
        <Section title="Skill Set" className="flex-2/3">
          <dl className="xs:mr-8 flex flex-col">
            {Object.entries(contexts.skills).map(([title, items]) => (
              <BorderBox key={title} className="flex flex-col">
                <dt className="mb-0.5 inline text-xs font-bold">
                  {startCase(title)}
                </dt>
                <dd className="inline text-xs leading-snug font-light">
                  {items.join(", ")}
                </dd>
              </BorderBox>
            ))}
          </dl>
        </Section>
        <Section title="Education" className="min-w-40 flex-1/3">
          {contexts.educations.map(({ degree, period, school, department }) => (
            <BorderBox
              key={degree}
              className="flex flex-col justify-between text-xs"
            >
              <div className="mb-0.5 flex justify-between font-bold">
                <div>{degree}</div>
                <div>{period}</div>
              </div>
              <div className="font-light">{school}</div>
              <div className="text-[10px] font-light">{department}</div>
            </BorderBox>
          ))}
        </Section>
      </div>
      <Section title="Experiences">
        {contexts.experiences.map(({ where, title, period, projects }) => (
          <Experience key={where} where={where} title={title} period={period}>
            {projects.map(({ title, extra, items }) => (
              <Project key={title} title={title} extra={extra} items={items} />
            ))}
          </Experience>
        ))}
      </Section>
    </main>
  );
}

function Title() {
  const email = new URL(document.location.toString()).searchParams.get("email");

  return (
    <div className="flex items-center">
      <h1 className="flex flex-wrap items-center gap-4 text-xl tracking-widest text-neutral-600 max-sm:gap-2">
        <span className="font-light">Chung, LiAn</span>{" "}
        <span className="border-l border-neutral-200 pl-4 font-bold text-neutral-800 max-sm:pl-2">
          Resume
        </span>
      </h1>
      <div className="ml-4 flex flex-col border-l border-neutral-200 pl-4 text-[10px] leading-3">
        <div className="tracking-[8px]">鍾禮安</div>
        <div className="tracking-wide">{email || "*******@gmail.com"}</div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="mt-2 -ml-2 flex flex-wrap items-center gap-1">
      <LinkSet
        icon={linkedinIcon}
        title="LinkedIn"
        url="https://www.linkedin.com/in/dennis-chung-tw"
      />
      <hr className="h-6 w-px bg-neutral-200" />
      <LinkSet
        icon={homepageIcon}
        title="Personal Website"
        url="https://hikarintu.github.io/homepage/"
      />
      <hr className="h-6 w-px bg-neutral-200" />
      <LinkSet
        icon={githubIcon}
        title="Github - hikariNTU"
        url="https://github.com/hikariNTU"
      />
    </header>
  );
}

function LinkSet(props: { icon: string; title: string; url: string }) {
  return (
    <a
      href={props.url}
      className="flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] transition-colors hover:bg-neutral-500/10"
    >
      <img src={props.icon} alt="" className="size-5" />
      <div className="overflow-hidden">
        <div>{props.title}</div>
        <div className="truncate text-[8px] text-neutral-600">{props.url}</div>
      </div>
    </a>
  );
}

function Section(
  props: PropsWithChildren<{ title: string; className?: string }>,
) {
  return (
    <section className={clsx("mt-4", props.className)}>
      <h2 className="mb-2 text-lg font-light text-neutral-500">
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function BorderBox({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={clsx(
        "border-b border-neutral-300 pt-2 pb-3 first-of-type:border-t",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Experience({
  period,
  title,
  where,
  children,
}: PropsWithChildren<{ where: string; title: string; period: string }>) {
  return (
    <BorderBox className="">
      <div className="mt-1 flex items-end gap-2">
        <h3 className="text-base leading-[1.1] font-bold">{where}</h3>
        <div className="text-xs font-light">{title}</div>
        <div className="ml-auto text-xs font-bold">{period}</div>
      </div>
      {children}
    </BorderBox>
  );
}

function Project({
  title,
  extra,
  items,
}: PropsWithChildren<{
  title: string;
  extra?: ReactNode;
  items: readonly string[];
}>) {
  return (
    <section className="my-2 break-inside-avoid pl-0.5">
      <div className="mb-1 flex items-end gap-1 text-xs">
        <h4>{title}</h4>
        {extra && (
          <div className="text-[10px] font-light">
            <MaybeLink>{extra}</MaybeLink>
          </div>
        )}
      </div>
      <ul className="list-disc pl-3.5 text-[10px] font-light">
        {items.map((v) => {
          const item = v.split("**").map((text, idx) => {
            if (idx % 2 === 0) {
              return text;
            }
            return <strong key={text}>{text}</strong>;
          });
          return <li key={v}>{item}</li>;
        })}
      </ul>
    </section>
  );
}

function MaybeLink({ children }: PropsWithChildren) {
  if (typeof children !== "string" || !children.startsWith("http")) {
    return children;
  }
  return (
    <a href={children} className="text-blue-600 hover:underline">
      {children}
    </a>
  );
}
