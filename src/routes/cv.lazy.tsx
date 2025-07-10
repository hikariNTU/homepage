import { CVPage } from "@/components/cv-page";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/cv")({
  component: () => <CVPage />,
});
