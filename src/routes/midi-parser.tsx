import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/midi-parser")({
  head() {
    return {
      meta: [
        {
          title: "MIDI Parser | Dennis Chung personal website",
        },
      ],
    };
  },
});
