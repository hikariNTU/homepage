type CVContext = {
  revision: string;
  var: string;
  intro: string;
  skills: {
    languages: string[];
    fullstack: string[];
    AIAndAutomation: string[];
  };
  educations: {
    degree: string;
    period: string;
    school: string;
    department: string;
  }[];
  experiences: {
    where: string;
    title: string;
    period: string;
    projects: {
      title: string;
      extra: string;
      items: string[];
      disable?: boolean;
    }[];
  }[];
};

export const defaultContexts: CVContext = {
  revision: "2026.06.18",
  var: "",
  intro:
    "Hi, I'm Dennis Chung. I am a full-stack engineer who specializes in modernizing core web architecture, optimizing distributed infrastructure, and orchestrating production-grade AI systems. From engineering low-latency browser DAWs utilizing the Web Audio and Canvas APIs to building context-aware AI platform agents integrated with live Kubernetes clusters, I focus on cutting operational latency and building developer platforms that scale. By anchoring my day-to-day workflow in specification-driven development and advanced AI automation, I bridge the gap between frontend execution, backend telemetry, and extreme delivery speed.",
  skills: {
    languages: [
      "TypeScript",
      "JavaScript (ES6+)",
      "Python (Data Pipelines/Scripting)",
      "SQL",
    ],
    fullstack: [
      "React",
      "Next.js",
      "Vue.js",
      "Module Federation",
      "Vite",
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
      department: "Information Management @ CMLab",
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

export const startupContexts: CVContext = {
  ...defaultContexts,
  var: "su",
  intro:
    "Hi, I'm Dennis Chung, a full-stack engineer with 6 years of experience. I specialize in building products from scratch and making sure they launch successfully, even under tight deadlines. My favorite part of the job is diving into complex product challenges and delivering the core features that users interact with. I thrive in fast-paced environments where I can build things quickly, handle the customer requirements of a live launch, and focus on shipping a stable, high-quality product for users.",
  skills: {
    ...defaultContexts.skills,
    languages: ["TypeScript", "JavaScript (ES6+)", "Python", "SQL"],
    fullstack: [
      "React",
      "Next.js",
      "NestJS",
      "TypeORM",
      "PostgreSQL/MySQL",
      "Vue.js",
      "TailwindCSS",
      "RadixUI",
      "TanStack Query",
      "Kubernetes (K8s)",
      "AWS",
      "GCP",
      "Terraform",
      "RabbitMQ",
    ],
  },
  experiences: [
    {
      where: "Netskope",
      title: "Senior Full Stack Engineer",
      period: "2025-09 ~ Now",
      projects: [
        {
          title: "On-call agent - Real-Time Diagnostic Agent",
          extra: "Slack AI Agent App",
          items: [
            "Co-developed an autonomous, Slack-native AI agent app integrated with Jira, Confluence, and live production infrastructure (**Kubernetes cluster states, Git logs, Sumo Logic, Grafana/Prometheus, and E2E login pipelines**) to resolve slow incident response times.",
            "Scaled the app company-wide across cross-functional channels, enabling PMs to track feature readiness and engineers to automate bug replication.",
            "Reduced incident triage duration from 10 minutes to 30 seconds (a **95% latency reduction**), drastically accelerating MTTR and catching **3** emerging infrastructure issues within the first 3 months of launch.",
          ],
        },
      ],
    },
    {
      where: "Taiwan AI Labs",
      title: "Lead Software Engineer, Fullstack",
      period: "2023-09 ~ 2025-09",
      projects: [
        {
          title: "Interactive Multimedia Exhibition Pavilion (2025)",
          extra: "https://www.moc.gov.tw/News_Content.aspx?n=105&s=230666",
          items: [
            "Architected and deployed an end-to-end multimedia generation exhibition for a massive public installation (Ministry of Culture) under a strict **6-month deadline**, featuring **mobile real-time AI chat connected with video generation** along with a 360° projection AI artwork.",
            "Built the **NestJS + Next.js** application including OAuth mechanisms and live QRCode validation with **auto-scaling pipelines** and a **task scheduler** deployed in **AWS Kubernetes (EKS)** with **Celery** to generate custom media in **under 2 minutes**, integrating the system with **MadMapper** on-site and backed by a MySQL + S3 storage system.",
            "Prompt-engineered various user interaction chat flows with a well-crafted **state machine system prompt**, ensuring accurate tool calling with advanced prohibition rules to prevent misuse.",
            "Collaborated on-site with hardware vendors to resolve playback lag and negotiated a high-pressure scoping split with the director to **prioritize P0 core features**, ensuring a successful live launch.",
          ],
        },
        {
          title: "FedGPT Multi-Modal Streaming Platform",
          extra: "https://fedgpt.cc",
          items: [
            "Built a rapid, high-fidelity frontend MVP within a strict **1-week deadline** to demonstrate **real-time voice loop capabilities** using web-native audio handling and a standard LLM chat completion API.",
            "The feature-complete demo served as a critical catalyst for closing an enterprise sale; the client subsequently **purchased the full-stack platform**, following up with additional enterprise contracts.",
          ],
        },
        {
          title: "Transkribera - Studio Core",
          extra: "https://asr.yating.tw",
          items: [
            "Maintained a high-scale transcription service (**1,500 DAU, 8,000 files/day**) with low query latency, while introducing a premium **AI summary feature** gated by a subscription model.",
            "Audited database queries with AWS CloudWatch, patched **missing SQL indexes**, and optimized core backend pipelines to reduce database CPU utilization by **90%**.",
            "Replaced **Webpack** with **Vite**, cutting production build times from 2 minutes down to 20 seconds and significantly increasing developer deployment velocity.",
          ],
        },
        {
          title: "AI Music - mini Browser Digital Audio Workstation (DAW)",
          extra: "https://studio.yating.tw/music",
          items: [
            "Built a highly **interactive Next.js** browser-based DAW with **tailwindcss + RadixUI** to handle intensive real-time multi-track rendering alongside AI-generated vocal tracks with pitch shifting.",
            "Leveraged the **Browser Audio Context API** and high-performance **HTML5 Canvas drawing** to implement real-time audio synesthesia, drag-and-drop note manipulation, and precise pitch/BPM shifting.",
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
          extra: "Site verification and validation tool",
          items: [
            "Built a plugin architecture service implementing **8 critical backend checkers** to automatically validate sites against recommended launch criteria.",
            "Optimized the tool to achieve a **500ms response time**, safely processing an average of **1,000 API calls per week**.",
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
          title: "XUI Component Library & xHIS Subsystems",
          extra: "Dedicated UI Framework and Hospital Information Systems",
          items: [
            "Created a custom **Vue Component Library** from scratch (15 components), implementing virtual scroll and sticky headers to match design specifications within a monorepo.",
            "Authored a new xHIS Patient Record subsystem using **Electron** and **Vue**, reducing user operation time by **50%** and achieving a compact **200KB gzipped bundle size** (a 95% reduction).",
            "Developed an **iPad mobile application** for inpatient rounding using WebView and Vue.js 3, replacing paper workflows, reducing rounding time by **35%**, and reaching **100 MAU / 10,000 monthly records** in the first quarter.",
          ],
        },
      ],
    },
  ],
};

export function getCVContext(varName: string | undefined): CVContext {
  switch (varName) {
    case "su":
      return startupContexts;
    case "default":
    default:
      return defaultContexts;
  }
}
