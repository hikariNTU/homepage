import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/symbols")({
  head() {
    return {
      meta: [
        {
          title: "Symbols | Dennis Chung personal website",
        },
        {
          name: "description",
          content:
            "Searchable cheat sheet for the symbols you actually need — math, Greek, arrows, currency, typography, box drawing. Click to copy the character, the code point, the HTML entity or the LaTeX command.",
        },
      ],
    };
  },
});
