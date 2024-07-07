import { atom, useAtomValue } from "jotai";
import { useCallback } from "react";

export type ProvidedLang = "zh-TW" | "en-US";
type TranslationsData = Record<string, Record<ProvidedLang, string>>;
export type TranslationsKey = keyof typeof translations;

const preferredLangKey = "preferredLang";
const langAtom = atom<ProvidedLang>(getPreferredLang());

export const currentLangAtom = atom(
  (get) => get(langAtom),
  (_, set, val: ProvidedLang) => {
    localStorage.setItem(preferredLangKey, val);
    set(langAtom, val);
  },
);
export const progressAtom = atom(1.0);

export function useTranslation() {
  const lang = useAtomValue(currentLangAtom);
  const progress = useAtomValue(progressAtom);
  const t = useCallback(
    (key: TranslationsKey) => {
      const data = translations[key];
      if (!data) {
        throw new Error(`Key: [${key}] is not found in translations file!`);
      }
      if (progress >= 1) {
        return data[lang];
      }
      const ops: ProvidedLang = lang === "en-US" ? "zh-TW" : "en-US";

      return (
        data[lang].substring(0, Math.floor(data[lang].length * progress)) +
        "🚧🚧⛔🚧🚧" +
        data[ops].substring(Math.floor(data[ops].length * progress))
      );
    },
    [lang, progress],
  );

  const fastT = useCallback(
    (key: TranslationsKey) => {
      return translations[key][lang];
    },
    [lang],
  );

  return {
    t,
    fastT,
  };
}

const translations = {
  readMore: {
    "zh-TW": "繼續閱讀...",
    "en-US": "Read More...",
  },
  selfTitle: {
    "en-US": "SELF",
    "zh-TW": "個人簡介",
  },
  specialTitle: {
    "en-US": "SPEC",
    "zh-TW": "專項能力",
  },
  photoTitle: {
    "en-US": "SHOT",
    "zh-TW": "攝影作品",
  },
  sitesTitle: {
    "en-US": "SITE",
    "zh-TW": "專案網站",
  },
  modelsTitle: {
    "en-US": "MODL",
    "zh-TW": "三維建模",
  },
  selfP1: {
    "zh-TW":
      "研究所主修電腦圖學，論文研究如何利用 f-map 配合 Laplace Interpolation 將人體器官表面模型轉換成目標之體態，出社會後發現還是喜歡做前端，就沒有深入圖學領域了。自學能力強，喜歡接觸新的知識、工具，對於 3D 建模，前端網頁開發有相當的了解。平常會遨遊大小開發社群，逛逛新的技術。目前將目光放在 Tanstack 的那些新奇玩意，希望哪天能將他們放到 Production 的網站上。",
    "en-US":
      "In graduate school, I majored in computer graphics. My thesis research focused on using f-maps in conjunction with Laplace Interpolation to transform human organ surface models into desired poses. After entering the workforce, I realized I still enjoy working on the front end, so I didn't delve deeper into the field of computer graphics. I have strong self-learning abilities and enjoy exploring new knowledge and tools. I have a good understanding of 3D modeling and front-end web development. I often participate in developer communities and keep up with new technologies. Currently, I'm interested in the exciting things coming from Tanstack and hope to incorporate them into a production website someday",
  },
  selfP2: {
    "zh-TW":
      "人生至今有滿滿的撰寫網頁經驗，一路從 FrontPage、DreamWeaver 走到 wordpress 再到 bootstrap + angularJS，最後投入 React 跟 Vue 這種前端亞馬遜叢林生態系的懷抱。每天思考著我的人生是不是有人刻了一個模板出來，然後上帝看著 dependencies install 後就 build 出一個個的人，早期在中研院資創所開發 WWW 2020 conference 的靜態網頁，React Material UI Gatsby nginx AWS SSL Reverse Proxy 樣樣來，現在回頭看看 styles 刻的爛到有剩，不過我想這就是我成長的象徵吧？那個上帝不好意思幫我升個 major 版號，謝謝。",

    "en-US":
      "Throughout my life, I've had abundant experience in web development. I've journeyed from FrontPage and DreamWeaver to WordPress, then to Bootstrap + AngularJS, and finally immersed myself in the Amazon rainforest ecosystem of React and Vue for front-end development. Every day, I wonder if someone created a template for my life, and then God watched as dependencies were installed to build each individual. In the early days, I developed static web pages for the WWW 2020 conference at the Academia Sinica Institute of Information Science. React, Material UI, Gatsby, Nginx, AWS, SSL, and reverse proxies—all came into play. Looking back, I realize my coding style was far from perfect, but perhaps that imperfection symbolizes growth. And as for that divine major version upgrade, well, I guess God was a bit busy. Thank you!",
  },
  selfP3: {
    "zh-TW":
      "曾經在 ASUS AICS當前端工程師，主要負責開發醫院內部系統使用的檢視網頁。也順帶將技能樹從爛爛的 Vue2 直升上Vue3，頓時豁然開朗，考試都考一百分了。過程還偷點了 iOS app的開發流程，不過是走 capacitor偷吃步，沒偷到多少，但吃了很多苦是真的。現在在哪間公司不好說，自己上 LinkedIn 看比較快，畢竟我換得挺快的。",
    "en-US":
      "I used to work as a front-end engineer at ASUS AICS, primarily responsible for developing web interfaces used within hospitals. Along the way, I upgraded my skill tree from the messy world of Vue 2 to the enlightening realm of Vue 3, and suddenly everything made sense—I aced my exams. I even dabbled in iOS app development, taking a shortcut with Capacitor, although I didn't gain much from it. Still, the experience was quite challenging. As for my current company, it's hard to say—I recommend checking my LinkedIn profile; after all, I switch jobs quite frequently",
  },
  migrationNote: {
    "zh-TW":
      "這個網站正在進行遷移的過程。遷移是我長時間以來想要做的事情。一開始，我直接使用 Gatsby 進入了現代 Web 開發的世界！不過，我猜現在 Gatsby 已經被 Next.js 取而代之了。所以有很多遺留的程式碼、樣式組件、Material UI 和帶有 YAML 數據提取器（噁心）的 GraphQL。現在已經是 2024 年了，沒有人再真正使用這些東西，所以我花了一些時間，試圖將這些東西遷移到 Vite + Tanstack Router + Tailwind CSS + Radix UI。而且我相信，最多三年後我還會再做同樣的事情 😀。",
    "en-US":
      "This website is under migration process. Migration is something I want to do in a long time. I initially start in modern web dev world with the knowledge of Gatsby directly! Which I guess nowadays it has been replaced by Next.js. So there's a lot of legacy code, styles component, material ui and graphql with yml data fetcher (pukes). And it is 2024, no one really using these stuff anymore, so I spent some time and trying to migrate these things into Vite + Tanstack Router + Tailwind CSS + Radix UI. And I believe I will do the same thing again in 3 years at most 😀.",
  },
} satisfies TranslationsData;

function getPreferredLang(): ProvidedLang {
  if (typeof window === "undefined") {
    return "en-US";
  }

  const savedResult = localStorage.getItem(preferredLangKey);
  if (
    savedResult &&
    (["en-US", "zh-TW"] as ProvidedLang[]).includes(savedResult as ProvidedLang)
  ) {
    return savedResult as ProvidedLang;
  }
  return window.navigator.language.startsWith("zh") ? "zh-TW" : "en-US";
}
