import { ComponentType, PropsWithChildren, ReactNode, useEffect } from "react";
import clsx from "clsx";
import { startCase } from "lodash";
import styleLink from "@/styles/cv.css?url";
import linkedinIcon from "@/assets/linkedin.png";
import githubIcon from "@/assets/github.png";
import homepageIcon from "@/assets/homepage-manifest-icon.png";
import { useStyleData } from "@/lib/useStyleData";
import { CVContext, getCVContext } from "@/data/cv-context";
import { cvImages } from "@/data/cv-images";
import {
  BookUserIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  LucideProps,
  ScrollTextIcon,
  ToolCaseIcon,
} from "lucide-react";

export function CVPage(props: { var: string | undefined }) {
  const contexts = getCVContext(props.var);
  useStyleData({
    id: "cv-styles",
    style: null,
    link: styleLink,
  });
  const revText = `${contexts.var ? "Resume" : "CV"}, Dennis Chung - Rev.${contexts.revision}${contexts.var ? ` - ${contexts.var}` : ""}`;

  useEffect(() => {
    document.title = revText;
  }, [revText]);

  return (
    <main className="mx-auto max-w-200 p-8 text-neutral-950 max-xs:p-4 print:zoom-110">
      <Title />
      <footer className="absolute top-8 right-8 text-[8px] text-neutral-600 max-xs:top-2 max-xs:right-2">
        {revText}
      </footer>
      <Header />
      <Section title="Summary" Icon={BookUserIcon}>
        <p className="text-[0.625rem] leading-normal font-normal">
          {contexts.intro}
        </p>
      </Section>
      <div className="flex flex-wrap justify-between print:mb-4">
        <Section title="Skill Set" className="flex-2/3" Icon={ToolCaseIcon}>
          <dl className="flex flex-col xs:mr-8">
            {Object.entries(contexts.skills).map(([title, items]) => (
              <BorderBox key={title} as="div" className="flex not-sm:flex-col">
                <dt className="mb-0.5 inline text-[0.625rem] font-semibold sm:w-32">
                  {startCase(title)}
                </dt>
                <dd className="inline flex-1 text-[0.625rem] leading-snug font-light">
                  {items.join(", ")}
                </dd>
              </BorderBox>
            ))}
          </dl>
        </Section>
        <Section
          title="Education"
          Icon={GraduationCapIcon}
          className="min-w-40 flex-1/3"
        >
          {contexts.educations.map(({ degree, period, school, department }) => (
            <BorderBox
              key={degree}
              className="flex flex-col justify-between pt-1 text-[0.625rem]"
            >
              <div className="font-light">{degree}</div>
              <div className="flex justify-between font-semibold">
                <div>{school}</div>
                <div>{period}</div>
              </div>
              <div className="font-normal">{department}</div>
            </BorderBox>
          ))}
        </Section>
      </div>
      <Section title="Experiences" Icon={ScrollTextIcon}>
        {contexts.experiences.map((exp) => (
          <Experience key={exp.where} data={exp}></Experience>
        ))}
      </Section>
    </main>
  );
}

function Title() {
  const email = new URL(document.location.toString()).searchParams.get("email");

  return (
    <div className="flex items-center gap-1 max-xs:mt-2 max-xs:flex-col max-xs:items-start">
      <h1 className="flex flex-wrap items-center gap-4 text-xl tracking-widest text-neutral-600 max-sm:gap-2">
        <span className="font-light">Chung, LiAn</span>{" "}
        <span className="border-l border-neutral-200 pl-4 font-semibold text-neutral-800 max-sm:pl-2">
          Resume
        </span>
      </h1>
      <div className="ml-4 flex flex-col border-l border-neutral-200 pl-4 text-[0.625rem] leading-3 max-xs:ml-0 max-xs:flex-row max-xs:border-none max-xs:pl-0">
        <div className="tracking-[8px]">鍾禮安</div>
        <div className="tracking-wide">{email || "*******@gmail.com"}</div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="mt-2 -ml-2 flex flex-wrap items-center gap-1 max-xs:flex-col max-xs:items-start">
      <LinkSet
        icon={linkedinIcon}
        title="LinkedIn"
        url="https://www.linkedin.com/in/dennis-chung-tw"
      />
      <hr className="h-6 w-px bg-neutral-200 max-xs:hidden" />
      <LinkSet
        icon={homepageIcon}
        title="Personal Website"
        url="https://hikarintu.github.io/homepage/"
      />
      <hr className="h-6 w-px bg-neutral-200 max-xs:hidden" />
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
      className="flex items-center gap-1 rounded-sm px-2 py-1 text-[0.625rem] transition-colors hover:bg-neutral-500/10"
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
  props: PropsWithChildren<{
    title: ReactNode;
    className?: string;
    Icon?: ComponentType<LucideProps>;
  }>,
) {
  return (
    <section className={clsx("mt-4", props.className)}>
      <h2 className="inline-flex items-center gap-1 text-sm text-neutral-600">
        {props.Icon ? <props.Icon size={16} aria-hidden /> : null}
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
        "border-b border-dashed border-neutral-300 py-2 first-of-type:border-t",
        className,
      )}
    >
      {children}
    </Component>
  );
}

function Experience({ data }: { data: CVContext["experiences"][number] }) {
  return (
    <BorderBox className="border-none">
      <div className="mt-1 flex grid-cols-[1fr_auto] items-end gap-2 [grid-template-areas:'company_period'_'title_title'] max-xs:grid">
        <h3 className="inline-flex items-center gap-1 text-base leading-[1.1] font-semibold text-neutral-600 [grid-area:company] max-xs:text-sm">
          <span className="sr-only">Company: </span>
          {cvImages[data.where] && (
            <img
              src={cvImages[data.where]}
              width={24}
              height={24}
              aria-hidden
              className="inline size-4"
            />
          )}
          {data.link ? (
            <a
              href={data.link}
              className="group text-neutral-600 transition-colors hover:text-blue-500 hover:underline focus-visible:text-blue-500 focus-visible:ring-blue-500"
            >
              <span className="pr-1">{data.where}</span>
              <ExternalLinkIcon
                className="absolute z-10 inline translate-y-0.5 bg-white opacity-0 outline-4 outline-white transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 print:invisible"
                size="14"
                aria-label={`Link to ${data.where}`}
              />
            </a>
          ) : (
            data.where
          )}
          <div
            aria-hidden
            className="hidden w-auto flex-1 translate-y-px self-center border-b border-dashed border-neutral-300 max-xs:inline"
          ></div>
        </h3>
        <div className="text-xs font-light [grid-area:title]">
          <span className="sr-only">Title: </span>
          {data.title}
        </div>
        <div
          aria-hidden
          className="w-auto flex-1 translate-y-px self-center border-b border-dashed border-neutral-300 max-xs:hidden"
        ></div>

        <div className="text-xs font-semibold whitespace-nowrap [grid-area:period]">
          <span className="sr-only">Period: </span>
          {data.period}
        </div>
      </div>
      <section className="mt-3">
        {data.projects.map(
          ({ title, extra, items, disable }) =>
            !disable && (
              <Project key={title} title={title} extra={extra} items={items} />
            ),
        )}
      </section>
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
      <div className="mb-1 flex items-end gap-1 text-xs font-semibold text-neutral-800 max-xs:flex-col max-xs:items-start">
        <h4>{title}</h4>
        {extra && (
          <div className="text-[0.625rem] font-light">
            <MaybeLink>{extra}</MaybeLink>
          </div>
        )}
      </div>
      <ul className="list-disc pl-3.5 text-[0.625rem] font-normal">
        {items.map((v) => {
          const item = v.split("**").map((text, idx) => {
            if (idx % 2 === 0) {
              return text;
            }
            return (
              <strong key={text} className="font-semibold text-neutral-800">
                {text}
              </strong>
            );
          });
          return (
            <li key={v} className="pb-1 print:pb-0.5">
              {item}
            </li>
          );
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
