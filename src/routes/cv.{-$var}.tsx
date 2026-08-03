import { createFileRoute } from "@tanstack/react-router";
import { getCVRevText } from "@/data/cv-meta";

export const Route = createFileRoute("/cv/{-$var}")({
  head({ params }) {
    return {
      meta: [
        {
          title: getCVRevText(params.var),
        },
        {
          name: "robots",
          content: "noindex",
        },
      ],
    };
  },
});
