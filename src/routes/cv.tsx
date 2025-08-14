import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cv")({
  head() {
    return {
      meta: [
        {
          title: "CV, Dennis Chung",
        },
      ],
    };
  },
});
