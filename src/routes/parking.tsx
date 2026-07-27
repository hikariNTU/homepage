import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/parking")({
  head() {
    return {
      meta: [
        {
          title: "Parking Fit | Dennis Chung personal website",
        },
      ],
    };
  },
});
