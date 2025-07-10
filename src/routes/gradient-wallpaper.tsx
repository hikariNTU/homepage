import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gradient-wallpaper")({
  head() {
    return {
      meta: [
        {
          title: "Gradient Wallpaper | Dennis Chung personal website",
        },
      ],
    };
  },
});
