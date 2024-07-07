import { currentLangAtom, progressAtom } from "@/translations";
import clsx from "clsx";
import { useAtom, useSetAtom } from "jotai";
import { TooltipWrap } from "./tooltip";

const totalCount = 100;
const delayMs = 40;

export function SwitchLang() {
  const [lang, setLang] = useAtom(currentLangAtom);
  const setProgress = useSetAtom(progressAtom);

  const toggle = () => {
    setLang(lang === "en-US" ? "zh-TW" : "en-US");
    setProgress(0);

    let count = totalCount;
    function inc() {
      count -= 1;
      setProgress((p) => p + 1.01 / totalCount);
      if (count > 0) {
        setTimeout(inc, delayMs);
      }
    }
    inc();
  };

  return (
    <TooltipWrap content="Incase you don't read Chinese/English">
      <button
        className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-4 py-1 font-light text-neutral-500 transition-colors hover:bg-neutral-950/5 active:bg-main-900/20"
        onClick={toggle}
      >
        <span
          className={clsx({
            "font-black text-main-800": lang === "en-US",
          })}
        >
          EN
        </span>
        <span>.</span>
        <span
          className={clsx({
            "font-black text-main-800": lang !== "en-US",
          })}
        >
          中文
        </span>
      </button>
    </TooltipWrap>
  );
}
