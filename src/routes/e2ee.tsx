import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/e2ee")({
  head() {
    return {
      meta: [
        {
          title: "E2EE, step by step | Dennis Chung personal website",
        },
        {
          name: "description",
          content:
            "An interactive end-to-end encryption visualizer: real Web Crypto, one crypto.subtle call per step, per device, with an adversary you control.",
        },
      ],
    };
  },
});
