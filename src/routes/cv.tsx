import { CVPage } from "@/components/cv-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cv")({
  component: () => <CVPage />,
});
