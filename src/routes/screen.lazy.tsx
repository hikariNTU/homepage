import { ScreenPage } from "@/components/screen.page";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/screen")({
  component: () => <ScreenPage />,
});
