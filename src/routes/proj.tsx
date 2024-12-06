import { createFileRoute } from "@tanstack/react-router";
import imgSrc from "@/assets/1280.png";

export const Route = createFileRoute("/proj")({
  component: () => (
    <div>
      <button
        className="fixed right-4 top-4 bg-red-300 p-2"
        onClick={() => {
          document.body.requestFullscreen();
        }}
      >
        全螢幕
      </button>
      <img
        src={imgSrc}
        alt=""
        width={1280}
        height={1024}
        className="h-[1024px] w-[1280px]"
      />
    </div>
  ),
});
