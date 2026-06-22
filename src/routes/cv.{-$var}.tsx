import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cv/{-$var}")({
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
