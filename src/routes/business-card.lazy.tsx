import { UnderMigration } from "@/components/under-migration";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/business-card")({
  component: () => <UnderMigration />,
});
