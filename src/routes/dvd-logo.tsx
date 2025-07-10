import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dvd-logo")({
  head() {
    return {
      meta: [
        {
          title: "DVD Logo | Dennis Chung personal website",
        },
      ],
    };
  },
});
