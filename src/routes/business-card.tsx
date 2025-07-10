import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/business-card")({
  head() {
    return {
      meta: [
        {
          title: "Business Card | Dennis Chung personal website",
        },
      ],
    };
  },
});
