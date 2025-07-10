import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/symbols")({
  head() {
    return {
      meta: [
        {
          title: "Symbols | Dennis Chung personal website",
        },
      ],
    };
  },
});
