import "@google/model-viewer";
import leatherImg from "@/assets/model/leather-poster.webp";
import leatherGlb from "@/assets/model/leather_card_case.glb?url";
import sensorImg from "@/assets/model/sensor-poster.webp";
import sensorGlb from "@/assets/model/sensor.glb?url";
import tankImg from "@/assets/model/tank-poster.webp";
import tankGlb from "@/assets/model/tank-obj.glb?url";
import panLidImg from "@/assets/model/panlid-poster.webp";
import panLidGlb from "@/assets/model/pan-lid.glb?url";
import { ModelViewerElement } from "@google/model-viewer";
import { TooltipWrap } from "./tooltip";

function ModelsViewer() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 p-2">
      {models.map((m) => (
        <div key={m.src}>
          <div className="lato mb-1 flex items-start justify-between text-sm text-main-900 dark:text-main-200">
            {m.title}
            {m.description && (
              <TooltipWrap content={m.description} className="max-w-96 p-6!">
                <button aria-label="info">
                  <InfoIcon className="text-xl" />
                </button>
              </TooltipWrap>
            )}
          </div>
          <model-viewer
            camera-controls
            src={m.src}
            id={m.src}
            onClick={() => {
              const el = document.getElementById(m.src) as ModelViewerElement;
              if (el) {
                el.dismissPoster();
              }
            }}
            camera-target={m["camera-target"]}
            camera-orbit={m["camera-orbit"]}
            field-of-view={m["field-of-view"]}
            class="wave-border"
            reveal="manual"
          >
            <img
              slot="poster"
              src={m.poster}
              alt=""
              className="h-full w-full cursor-pointer object-contain transition-opacity hover:opacity-80"
            />
            {m.hotspots.map(({ text, ...data }, index) => {
              const uid = `hotspot-${index + 1}`;
              return (
                <div
                  key={uid}
                  slot={uid}
                  className="pointer-events-none rounded-sm bg-main-100/80 p-1 dark:bg-neutral-950"
                  data-visibility-attribute="visible"
                  {...data}
                >
                  {text}
                </div>
              );
            })}
          </model-viewer>
        </div>
      ))}
    </div>
  );
}

export default ModelsViewer;

const models = [
  {
    title: "MICROPHONE SENSOR FOR PAPER FIGURE",
    description:
      "This is an illustrate for a two-side Stethoscope with digital sensor that's used in our experiment.",
    "camera-target": "0m 0.2m 0m",
    hotspots: [
      {
        "data-position":
          "0.335036947293169m 0.506937119332304m 0.1330823992433362m",
        "data-normal":
          "-0.2615551951742752m -0.15016246367052444m 0.9534359519032967m",
        text: "Data transfer wires",
      },
      {
        "data-position":
          "-0.471407589295481m 0.36217868731903247m 0.31675226711636195m",
        "data-normal":
          "-0.285915579917398m 0.9409760316158967m 0.1811529439034795m",
        text: "Outra-microphone",
      },
      {
        "data-position":
          "-0.7896850242301849m 0.08033889705454711m -0.6609722296929244m",
        "data-normal":
          "-0.6999294583161975m 0.38288141059334274m -0.6029100918074323m",
        text: "Rubber plate",
      },
    ],
    reveal: "interaction",
    text: "Microphone sensor for paper figure",
    poster: sensorImg,
    "field-of-view": "32.24deg",
    "camera-orbit": "303.5deg 70.72deg 4.241m",
    "camera-controls": true,
    src: sensorGlb,
  },
  {
    title: "LEATHER CARD CASE",
    description:
      "This is a blue print of my gift to my wife. I spent about a week to create the final product using some decent leather.",
    hotspots: [
      {
        "data-position":
          "-0.04656914635909719m 0.0025600264527007865m 0.031203891244006833m",
        "data-normal":
          "-0.029285193425190387m 0.9981368383552182m 0.05352783728396086m",
        text: "\u7fa9\u5927\u5229\u5c0f\u725b\u8edf\u76ae",
      },
      {
        "data-position":
          "-0.05432288388259335m 0.0029349935234377106m -0.005463521118321993m",
        "data-normal":
          "-0.7113153840542583m 0.46670491043609863m 0.5255634604713082m",
        text: "\u96d9\u91dd\u7e2b\u56db\u80a1\u881f\u7dda",
      },
      {
        "data-position":
          "-0.0005400806194648892m -0.002348745625782675m -0.03615245276264464m",
        "data-normal": "0.007320459268392187m 0.9999732050790661m 0m",
        text: "\u7d10\u897f\u862d\u5c0f\u7f94\u7f8a\u786c\u76ae",
      },
      {
        "data-position":
          "0.04601326434673596m 0.0018551211256368008m 0.0396408863272535m",
        "data-normal":
          "-0.0026881043336977888m -0.02167612825873127m 0.999761431321894m",
        text: "\u9ed1\u8272\u5c01\u908a\u6cb9\uff08\u672a\u5efa\u6a21\uff09",
      },
    ],
    reveal: "interaction",
    src: leatherGlb,
    "field-of-view": "45deg",
    poster: leatherImg,
    text: "Leather Card Case",
    "camera-orbit": "-56.61deg 58.59deg 0.1929m",
    "camera-controls": true,
  },
  {
    title: "POLY TANK USED IN GAME",
    description:
      "This is one of the object that I've created when I am taking Game Design course. Originated from Leopard 2.",
    hotspots: [
      {
        "data-position":
          "0.09482903002595933m 2.2983362983965674m 3.3489835082347152m",
        "data-normal": "0.9659257858615895m 0.2588191959798789m 0m",
        text: "Movable Barrel",
      },
      {
        "data-position":
          "0.8914322010146494m 2.0757550358931107m -0.15874459964881105m",
        "data-normal":
          "0.9023837846762063m 0.4077217214197909m -0.13952241051504452m",
        text: "Rotatable Turret",
      },
    ],
    reveal: "interaction",
    "shadow-softness": "1",
    "shadow-intensity": "2.3",
    "field-of-view": "38.09deg",
    poster: tankImg,
    text: "Poly Tank used in Game",
    "camera-orbit": "39.4deg 75.91deg 10.91m",
    "camera-controls": true,
    src: tankGlb,
  },
  {
    title: "A LID ASSEMBLY INSTRUCTION",
    description:
      "One of my friend ask me how to assembly a pan lid. Since there's no manual inside the product box. I made this animation for her.",
    hotspots: [
      {
        "data-position":
          "-0.033332849427221145m -0.15240995921402356m 0.02058458218225856m",
        "data-normal":
          "-0.42975074565230253m -0.8731473459287948m 0.23006088087458854m",
        text: "Screw",
      },
      {
        "data-position":
          "0.011598157727084613m 0.016345077013524195m 0.05388592890190791m",
        "data-normal":
          "-0.000861530403012226m -0.9999952591581575m -0.0029562521161476626m",
        text: "Washer",
      },
      {
        "data-position":
          "-0.012473918064020317m 0.10985430869794433m 0.04377519007803943m",
        "data-normal":
          "-0.10879924542341203m -0.9270362753496493m 0.3588404497560795m",
        text: "Gasket",
      },
      {
        "data-position":
          "-0.09007938407330474m 0.10465510754282753m 0.8465444754873467m",
        "data-normal":
          "-0.05108269479568595m 0.9085057969406299m 0.41473820081791574m",
        text: "Glass Lid",
      },
      {
        "data-position":
          "0.3702476685245073m -0.03837703603807191m 0.8975856491503691m",
        "data-normal":
          "0.06194708414159342m -0.9882855828322882m 0.13947819016677487m",
        text: "Stainless Rim",
      },
      {
        "data-position":
          "-0.0806619421908259m 0.48122527597717774m 0.16507191387471498m",
        "data-normal":
          "-0.42787868862424455m -0.311049768479352m 0.8486270496219986m",
        text: "Handle",
      },
    ],
    reveal: "interaction",
    src: panLidGlb,
    "field-of-view": "45deg",
    "camera-controls": true,
    poster: panLidImg,
    "camera-orbit": "-42deg 102.2deg 2.253m",
    text: "An instruction to combine pan lid",
    "animation-name": "Animation",
    autoplay: true,
  },
];

const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-info"
    {...props}
  >
    <circle cx={12} cy={12} r={10} />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
