import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/screen")({
  head() {
    return {
      meta: [
        {
          title: "Screen Measurement | Dennis Chung personal website",
        },
      ],
    };
  },
});
