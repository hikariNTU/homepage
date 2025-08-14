import styleData from "@/styles/cv.css?inline";
import { PropsWithChildren, ReactNode, useLayoutEffect } from "react";
import linkedinIcon from "@/assets/linkedin.png";
import githubIcon from "@/assets/github.png";
import homepageIcon from "@/assets/homepage-manifest-icon.png";

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
  });
}

export function CVPage() {
  useStyleData();
  return (
    <main className="mx-auto max-w-[800px] p-8 text-neutral-950">
      <Title />
      <footer className="absolute right-8 top-8 text-[6px]">
        Rev.2024.11.03
      </footer>
      <Header />
      <Section title="Summary">
        <p className="text-xs">
          I mainly focus on web development. I have strong experience with HTML
          and CSS and all modern JS/TS developing toolchains. I also enjoy
          creating visual art, including graphic design and 3D modeling. The
          combination of these skills makes me focus on innovation.
        </p>
      </Section>
      <div className="flex flex-wrap">
        <Section title="Skill Set">
          <dl className="mr-8 flex max-w-72 flex-col text-sm font-light">
            <dt className="mt-2 inline font-bold first-of-type:mt-0">
              Launguage
            </dt>
            <dd className="inline text-xs">
              Javascript, Typescript, Python, HTML5, CSS3
            </dd>
            <dt className="mt-2 inline font-bold first-of-type:mt-0">
              Framework & Tools
            </dt>
            <dd className="inline text-xs">
              React, Next, Vue, NestJS, Express, Vite, Rollup, Docker, Git, K8S,
              MySQL, TypeORM, AWS
            </dd>
            <dt className="mt-2 inline font-bold first-of-type:mt-0">Others</dt>
            <dd className="inline text-xs">
              Figma, Photoshop, Illustrator, LightRoom, Blender
            </dd>
          </dl>
        </Section>
        <Section title="Education">
          <BorderBox>
            <div className="flex justify-between text-[10px]">
              <div>Bachelor</div>
              <div>2013 ~ 2017</div>
            </div>
            <div className="text-xs font-bold">National Taiwan University</div>
            <div className="text-xs">Infomation Management</div>
          </BorderBox>
          <BorderBox>
            <div className="flex justify-between text-[10px]">
              <div>Master</div>
              <div>2017 ~ 2019</div>
            </div>
            <div className="text-xs font-bold">National Taiwan University</div>
            <div className="text-xs">CMLab@Infomation Management</div>
          </BorderBox>
        </Section>
      </div>
      <Section title="Experiences">
        <Experience
          where="Taiwan AI Labs"
          title="Lead Software Engineer, Fullstack (Studio Team)"
          period="2023-09 ~ Now"
        >
          <Project
            title="AI-music experience Engineering - Hualien AI Music experimental base"
            extra="(Start in 2025 Q1)"
            items={[
              "An astonishing experience where visitors can use their phones to scan a QR code, chat with AI to create unique music with a music video, and then schedule and play the video on 360-degree projector screens.",
            ]}
          />
          <Project
            title="Yating Studio"
            extra="https://studio.yating.tw"
            items={[
              "Recreate the whole AI-Music frontend using Next.js and React-Query with TailwindCSS and RadixUI.",
              "Astonishing animations with optmized performance, leading to a **score of 90+ in lighthouse benchmark**",
            ]}
          />
          <Project
            title="FedGPT - Studio"
            extra="https://fedgpt.cc"
            items={[
              "Apply Voice QA with **ASR and TTS** api to provide the ability to literally chat with LLM models.",
              "Implement extra markdown component to deal with special response like video retrival result or avatar result",
            ]}
          />
        </Experience>
        <Experience
          where="Houzz"
          title="Fullstack Engineer (Website Services)"
          period="2022-04 ~ 2023-08"
        >
          <Project
            title="Prebublish Wizard"
            extra="A supporting tool which checks if the site meets recommended criteria"
            items={[
              "Designed and build a general interface to implement each checker",
              "8 checkers running in the backend with a 500ms response time. On average, there are 1000 API calls per week.",
            ]}
          />
        </Experience>
        <Experience
          where="ASUS AICS"
          title="Software Engineer"
          period="2021-03 ~ 2022-04"
        >
          <Project
            title="XUI"
            extra="Dedicated Vue Component Library for xHIS"
            items={[
              "Create the UI framework based on Vue to match our fine-tuned design specification",
              "Designed **15 components**, including a complex table component with virtual scroll and sticky header ability",
              "Fully written in TypeScript and well-documented with an interactive website. The monorepo structure improves the DX as well",
            ]}
          />
          <Project
            title="xHIS Patient Record submodule"
            extra="A sub-system in xHIS to provide CRUD functionality for patient's records"
            items={[
              "Built on top of Electron and Vue, providing a faster UI experience compared to the original system by reducing operation time by 50%",
              "Zero UI framework included. Components are built with Vue and CSS only, resulting in a 200KB gzip size of our frontend bundle. Normal projects that include a lightweight UI framework would end up with a 2-4MB bundle size, **saving up to 95% bundle size**.",
              "Fully written in TypeScript and well-documented with an interactive website. The monorepo structure improves the DX as well",
            ]}
          />
          <Project
            title="xHIS Mobile Rounding"
            extra="A Medical rounding supporting application run on iPad for daily usage"
            items={[
              "Provided a mobile solution for inpatient rounding procedures, eliminating the need for paper documents",
              "Currently deployed in a single hospital with **100 mounthly active users(MAU) and 10k MAR** in 2021 Q3",
              "Greatly **reduced the rounding time by up to 35%**. Patients can also benefit from the medical record that our app can display",
            ]}
          />
        </Experience>
      </Section>
    </main>
  );
}

function Title() {
  return (
    <h1 className="flex flex-wrap items-center gap-4 text-xl tracking-widest text-neutral-600 max-sm:gap-2">
      <span className="font-light">Chung, LiAn</span>{" "}
      <span className="border-l pl-4 font-bold text-neutral-800 max-sm:pl-2">
        Resume
      </span>
    </h1>
  );
}

function Header() {
  const email = new URL(document.location.toString()).searchParams.get("email");
  return (
    <header className="mt-4 flex flex-wrap items-center gap-2">
      <div className="mr-4 flex-1 text-[10px] font-bold">
        <div className="tracking-[8px]">鍾禮安</div>
        <span className="tracking-wide">{email || "*******@gmail.com"}</span>
      </div>
      <div className="-ml-2 flex flex-wrap items-center gap-2">
        <LinkSet
          icon={linkedinIcon}
          title="LinkedIn"
          url="https://www.linkedin.com/in/dennis-chung-tw"
        />
        <LinkSet
          icon={homepageIcon}
          title="Personal Website"
          url="https://hikarintu.github.io/homepage/"
        />
        <LinkSet
          icon={githubIcon}
          title="Github - hikariNTU"
          url="https://github.com/hikariNTU"
        />
      </div>
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

function Section(props: PropsWithChildren<{ title: string }>) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-2xl font-black">{props.title}</h2>
      {props.children}
    </section>
  );
}

function BorderBox({ children }: PropsWithChildren) {
  return (
    <section className="border border-t-0 border-neutral-600 px-3 pb-3 pt-2 first-of-type:rounded-t-xl first-of-type:border-t last-of-type:rounded-b-xl">
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
    <BorderBox>
      <div className="mt-1 flex items-end gap-2">
        <h3 className="text-base font-bold leading-[1.1]">{where}</h3>
        <div className="text-xs font-light">{title}</div>
        <div className="ml-auto text-xs font-light">{period}</div>
      </div>
      {children}
    </BorderBox>
  );
}

function Project({
  title,
  extra,
  items,
}: PropsWithChildren<{ title: string; extra?: ReactNode; items: string[] }>) {
  return (
    <section className="my-2 pl-0.5">
      <div className="mb-1 flex items-end gap-1 text-xs">
        <h4>{title}</h4>
        {extra && <div className="text-[10px] font-light">{extra}</div>}
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
