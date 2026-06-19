import { PropsWithChildren, ReactNode, useEffect } from "react";
import clsx from "clsx";
import { startCase } from "lodash";
import styleLink from "@/styles/cv.css?url";
import linkedinIcon from "@/assets/linkedin.png";
import githubIcon from "@/assets/github.png";
import homepageIcon from "@/assets/homepage-manifest-icon.png";
import { useStyleData } from "@/lib/useStyleData";

const contexts = {
  revision: "2026.06.18",
  intro:
    "Hi, I'm Dennis Chung. I am a full-stack engineer who specializes in modernizing core web architecture, optimizing distributed infrastructure, and orchestrating production-grade AI systems. From engineering low-latency browser DAWs utilizing the Web Audio and Canvas APIs to building context-aware AI platform agents integrated with live Kubernetes clusters, I focus on cutting operational latency and building developer platforms that scale. By anchoring my day-to-day workflow in specification-driven development and advanced AI automation, I bridge the gap between frontend execution, backend telemetry, and extreme delivery speed.",
  skills: {
    languages: ["TypeScript", "JavaScript (ES6+)", "Python", "SQL"],
    frontendArchitecture: [
      "React",
      "Next.js",
      "Vue.js",
      "Module Federation",
      "Vite",
      "Rollup",
      "Web Audio API",
      "HTML5 Canvas",
    ],
    backendAndInfra: [
      "NestJS",
      "Express",
      "TypeORM",
      "Kubernetes (K8s)",
      "AWS",
      "GCP",
      "Terraform",
      "RabbitMQ",
    ],
    AIAndAutomation: [
      "AI-Agent Workflows",
      "Specification-Driven Development (SDD)",
      "OpenAPI / JSON Schema Orchestration",
      "Claude API & LLM Tooling",
    ],
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
      where: "Netskope",
      title: "Senior Software Engineer (WebUI InlineSWG)",
      period: "2025-09 ~ Now",
      projects: [
        {
          title: "Context-Aware AI On-Call Agent (Slack-Native IDP)",
          extra: "Generative AI & Enterprise Knowledge Automation",
          items: [
            "**Challenge:** Critical system escalations and project tracking suffered from slow resolution times because stakeholders had to manually aggregate fragmented diagnostic data, Jira timelines, and code states across multiple internal platforms.",
            "**Action:** Co-developed an autonomous, Slack-native AI agent integrated with enterprise knowledge bases (Jira, Confluence, onboarding docs) and live production infrastructure (**Kubernetes cluster states, Git logs, Sumo Logic, Grafana/Prometheus, login E2E test against production websites**).",
            "**Scale & Impact:** Successfully expanded adoption across cross-functional channels; transformed the tool into a company-wide assistant enabling PMs to track feature readiness and outside engineers to automate bug replication scenarios.",
            "**Result & Metric:** Established as the company's highest-accuracy internal AI agent, providing instant root-cause analysis with verifiable evidence links. Slashed incident triage duration from 10 minutes down to 30 seconds, achieving a 95% reduction in frontline triage latency and drastically accelerating overall MTTR. After the first 3 months of launch, our team caught **3** emerging infra structure issues before other teams.",
          ],
        },
        {
          title: "Next-Gen WebUI Architecture & AI-Assisted Migration",
          extra: "Infrastructure Modernization & Technical Evangelism",
          items: [
            "**Challenge:** Legacy build configurations caused severe pipeline latency across 10+ micro-frontend applications, while migrating to a modern testing framework faced high friction and adoption resistance from distributed feature teams.",
            "**Action:** Spearheaded the core migration to **Vite** and **Module Federation** while engineering an autonomous AI-agent migration skill that automatically audited repositories, caught common pitfalls (e.g., unmocked requests, feature-flag providers), and generated tailored, risk-free co-existence blueprints for **Playwright** and **Cypress**.",
            "**Leadership:** Evangelized the framework by delivering a comprehensive technical presentation to the global WebUI team (~50 engineers), illustrating architectural benefits, zero-downtime rollback protocols, and practical Claude API utilization.",
            "**Metric:** Slashed local server spin-up times by **90%** (45s to <3s), accelerated CI pipeline execution by **40%**, and successfully initiated team-wide rollout, establishing a seamless co-existence framework actively adopted by micro-frontend code owners without delivery disruption.",
          ],
        },
      ],
    },
    {
      where: "Taiwan AI Labs",
      title: "Lead Software Engineer, Fullstack (Studio Team)",
      period: "2023-09 ~ 2025-09",
      projects: [
        {
          title: "Interactive AI-Music Exhibition Pavilion(2025)",
          extra: "https://www.moc.gov.tw/News_Content.aspx?n=105&s=230666",
          items: [
            "**Challenge:** Architect and deploy an end-to-end multimedia generation pipeline for a massive public installation (Ministry of Culture) under a strict 3-month deadline, resolving severe on-site network lag, bandwidth limits, and 360° projection synchronization issues.",
            "**Action:** Built an **AWS Kubernetes (EKS)** auto-scaling pipeline that handled mobile web QR-code scanning, real-time chat inputs, and distributed processing to generate custom AI media in **under 3 minutes**; integrated the cloud pipeline with an on-site media player and professional projection software (**MadMapper**).",
            "**Stakeholder Leadership:** Collaborated on-site with hardware vendors and audio engineers to resolve playback lag; negotiated a high-pressure scoping split with the creative director to prioritize P0 core system stability over minor features to guarantee a flawless launch, bringing postponed features back into the AWS pipeline over the next year.",
            "**Result:** Successfully delivered a stable, low-latency infrastructure managing public user sessions and real-time media generation for flawless, synchronized 360° pavilion playback.",
          ],
        },
        {
          title: "Transkribera - Studio Core",
          extra: "https://asr.yating.tw",
          items: [
            "**Challenge:** Maintain a high-scale transcription service (**1,500 DAU, 8,000 files/day**) with stable data pipelines and low query latency.",
            "**Action:** Audited database queries, patched missing SQL indexes, managed ASR processors autoscaling, and integrated a new AI-based summary pipeline feature.",
            "**Metric:** Reduced core database CPU utilization by **90%** through targeted SQL optimization.",
          ],
        },
        {
          title: "AI-Music Vocal Generation Platform & Browser DAW",
          extra: "https://studio.yating.tw/music",
          items: [
            "**Challenge:** Build a complex, highly interactive Digital Audio Workstation (DAW) entirely inside the browser with AI synthetic audio generation.",
            "**Action:** Leveraged the **Browser Audio Context API** and high-performance **HTML5 Canvas drawing** to engineer real-time audio synesthesia, drag-and-drop note manipulation, and pitch/BPM shifting.",
            "**Result:** Enabled creators to edit MIDI files natively and introduced a near zero-shot automated song generation feature.",
          ],
        },
        {
          title: "FedGPT Multi-Modal Streaming Platform",
          extra: "https://fedgpt.cc",
          items: [
            "**Challenge:** Deliver real-time, low-latency streaming audio interactions while safely rendering diverse LLM outputs.",
            "**Action:** Engineered full-stack streaming audio stacks (ASR → custom orchestration layer → TTS) paired with hybrid model routing and sanitized renderers.",
            "**Result:** Built a highly extensible, secure platform optimized for high-performance multi-modal model serving.",
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

export function CVPage() {
  useStyleData({
    id: "cv-styles",
    style: null,
    link: styleLink,
  });

  useEffect(() => {
    document.title = `CV, Dennis Chung - Rev.${contexts.revision}`;
  }, []);

  return (
    <main className="mx-auto max-w-200 p-8 text-neutral-950">
      <Title />
      <footer className="absolute top-8 right-8 text-[6px]">
        Rev.{contexts.revision}
      </footer>
      <Header />
      <Section title="Summary">
        <p className="text-xs leading-normal font-light">{contexts.intro}</p>
      </Section>
      <div className="flex flex-wrap justify-between print:mb-4">
        <Section title="Skill Set" className="flex-2/3">
          <dl className="flex flex-col xs:mr-8">
            {Object.entries(contexts.skills).map(([title, items]) => (
              <BorderBox key={title} as="div" className="flex flex-col">
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
  as = "section",
}: PropsWithChildren<{ className?: string; as?: React.ElementType }>) {
  const Component = as;
  return (
    <Component
      className={clsx(
        "border-b border-neutral-300 pt-2 pb-3 first-of-type:border-t",
        className,
      )}
    >
      {children}
    </Component>
  );
}

function Experience({
  period,
  title,
  where,
  children,
}: PropsWithChildren<{ where: string; title: string; period: string }>) {
  return (
    <BorderBox className="break-inside-avoid border-none">
      <div className="mt-1 flex items-end gap-2">
        <h3 className="text-base leading-[1.1] font-bold">
          <span className="sr-only">Company: </span>
          {where}
        </h3>
        <div className="text-xs font-light">
          <span className="sr-only">Title: </span>
          {title}
        </div>
        <div className="text-xs font-bold">
          <span className="sr-only">Period: </span>
          {period}
        </div>
        <div
          aria-hidden
          className="w-auto flex-1 self-center border-b border-dashed border-neutral-300"
        ></div>
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
  if (typeof children !== "string") {
    return children;
  }

  const chunks = children.split("|").map((s) => s.trim());
  return (
    <>
      {chunks.map((text) => {
        if (text.startsWith("http")) {
          return (
            <a key={text} href={text} className="text-blue-600 hover:underline">
              {text}
            </a>
          );
        }
        return text;
      })}
    </>
  );
}
